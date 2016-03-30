class LinkRtcBaseError extends Error {
    constructor(message = '') {
        message = String(message || '');
        super(message);
        this.name = this.constructor.name;
        this.message = message;
        this.stack = (new Error()).stack;
    }
}


class LinkRtcRpcError extends LinkRtcBaseError {
    constructor(code, message = '') {
        code = parseInt(code);
        super(message);
        this.code = code;
    }
}


class LinkRtcCall {
    constructor(data, pc, onAnswer = null, onRelease = null, onStateChange = null) {
        this.data = data;
        this.pc = pc;
        this.onAnswer = onAnswer;
        this.onRelease = onRelease;
        this.onStateChange = onStateChange;
    }
}


class LinkRtcClient {
    constructor({
        url,
        pcConfiguration,
        pcConstraints = {},
        audioPlayer,
        iceTimeout=30000,
        onCallIncoming = null,
        onCallAnswer = null,
        onCallRelease = null,
        onCallStateChange = null
    }) {
        this._url = url;
        this._webSocket = null;
        this._pendingRequests = {};
        this._calls = {};
        this._localStream = null;
        this._callHandlers = {
            onCallIncoming: onCallIncoming,
            onCallAnswer: onCallAnswer,
            onCallRelease: onCallRelease,
            onCallStateChange: onCallStateChange
        };
        this._pcConfiguration = pcConfiguration;
        this._pcConstraints = pcConstraints;
        this._audioPlayer = audioPlayer;
        this._iceTimeout = iceTimeout;
    }

    static makeID() {
        return (Date.now().toString(36) + Math.random().toString(36).substr(2, 5)).toUpperCase();
    }

    // Workaround for crbug/322756.
    static maybeAddLineBreakToEnd(sdp) {
        let endWithLineBreak = new RegExp(/\n$/);
        if (!endWithLineBreak.test(sdp)) {
            return sdp + '\n';
        }
        return sdp.replace(/\r?\n/g, "\r\n");
    }

    _popPendingRequest(requestID) {
        let pendingRequest = this._pendingRequests[requestID];
        if (pendingRequest) {
            delete this._pendingRequests[requestID];
        }
        return pendingRequest === undefined ? null : pendingRequest;
    }

    _onMessage(message) {
        let data = JSON.parse(message.data);
        if ('result' in data) {
            if (data.id) {
                let pendingRequest = this._popPendingRequest(data.id);
                if (pendingRequest) {
                    if (pendingRequest.timeoutID)
                        clearTimeout(pendingRequest.timeoutID);
                    pendingRequest.resolve(data.result);
                }
            }
        } else if ('error' in data) {
            if (data.id) {
                let pendingRequest = this._popPendingRequest(data.id);
                if (pendingRequest) {
                    if (pendingRequest.timeoutID)
                        clearTimeout(pendingRequest.timeoutID);
                    pendingRequest.reject(new LinkRtcRpcError(data.error.code, data.error.message));
                }
            }
        } else if ('method' in data) {
            if (data.method == 'onCallAnswered') {
                let cid = data.params[0];
                let sdp = data.params[1];
                let call = this._calls[cid];
                sdp = this.constructor.maybeAddLineBreakToEnd(sdp);
                let desc = new RTCSessionDescription({
                    type: 'answer',
                    sdp: sdp
                });
                call.pc.setRemoteDescription(
                    desc, // SDP
                    () => { // successCallback
                        if (call)
                            if (call.onAnswer) // 远端接听的回调！！
                                call.onAnswer(call);
                    },
                    errorInfo => { // errorCallback
                        // TODO: 错误处理，要挂断！！！
                        console.error(`${errorInfo}\n${sdp}`);
                    }
                );
            } else if (data.method == 'onCallReleased') {
                let cid = data.params[0];
                let call = this._calls[cid];
                delete this._calls[cid];
                call.pc.close();
                call.pc = null;
                if (call.onRelease)
                    call.onRelease(call);
            } else if (data.method == 'onCallStateChanged') {
                let cid = data.params[0];
                let currentState = data.params[1];
                let call = this._calls[cid];
                let priorState = call.state;
                call.state = currentState;
                if (call.onStateChange)
                    call.onStateChange(call, priorState, currentState);
            } else if (data.method == 'onCallIncoming') {
                let callData = data.params[0];
                let call = this._calls[callData.cid] = new LinkRtcCall(
                    callData,
                    null,
                    this._callHandlers.onCallAnswer,
                    this._callHandlers.onCallRelease,
                    this._callHandlers.onCallStateChange
                );
                this._callHandlers.onCallIncoming(call);
            }
            else {
                throw new Error(`unknown method ""${data.method}`);
            }
        }
    }

    get url() {
        return this._url;
    }

    setLocalAudioStream(stream = null) {
        return new Promise((resolve, reject) => {
            if (stream) {
                this._localStream = stream;
                resolve(stream);
            } else {
                navigator.getUserMedia(
                    {audio: true, video: false}, // navigator.getUserMedia options
                    stream => { // navigator.getUserMedia on-success
                        this._localStream = stream;
                        resolve();
                    },
                    error => { // navigator.getUserMedia on-error
                        reject(error);
                    }
                );
            }
        });
    }

    request(method, params = [], timeout = 30000) {
        return new Promise((resolve, reject) => {
            let requestID = this.constructor.makeID();
            let timeoutID = null;
            let data = {
                jsonrpc: '2.0',
                id: requestID,
                method: method.toString(),
                params: params
            };
            this._webSocket.send(JSON.stringify(data));
            if (timeout > 0) {
                timeoutID = setTimeout(requestID => {
                    let pendingRequest = this._popPendingRequest(requestID);
                    if (pendingRequest) {
                        pendingRequest.reject(new Error('Timeout'));
                    }
                }, timeout, requestID);
            }
            this._pendingRequests[requestID] = {
                resolve: resolve,
                reject: reject,
                timeoutID: timeoutID
            };
        });
    }

    connect() {
        return new Promise((resolve, reject) => {
            this._webSocket = new WebSocket(this._url);
            this._webSocket.onmessage = this._onMessage.bind(this);
            this._webSocket.onclose = close => {
                this._webSocket = null;
                reject(close);
            };
            this._webSocket.onerror = error => {
                this._webSocket = null;
                reject(error);
            };
            this._webSocket.onopen = open => {
                resolve(open);
            };
        });
    }


    makeCall(to, iceTimeout = null) {
        return new Promise((resolve, reject) => {
            to = String(to || '');
            let iceTimeoutId = null;
            let pc = new RTCPeerConnection(this._pcConfiguration, this._pcConstraints);
            let onIceComplete = self => {
                self.request('makeCall', [pc.localDescription.sdp, to])
                    .then(callData => {
                        let call = self._calls[callData.cid] = new LinkRtcCall(
                            callData,
                            pc,
                            this._callHandlers.onCallAnswer,
                            this._callHandlers.onCallRelease,
                            this._callHandlers.onCallStateChange
                        );
                        resolve(call);
                    })
                    .catch(error => {
                        reject(error);
                    });
            };
            pc.onaddstream = event => {
                console.log("Add Stream: ", event.stream);
                this._audioPlayer.srcObject = event.stream;
            };
            pc.onremovestream = event => {
                console.log("Remove Stream: ", event.stream);
            };
            pc.addStream(this._localStream);
            pc.onicecandidate = event => {
                if (!event.candidate) {// Local ICE candidate OK!
                    if (iceTimeoutId) {
                        clearTimeout(iceTimeoutId);
                        iceTimeoutId = null;
                        onIceComplete(this);
                    }
                }
            };
            pc.createOffer(
                desc => { // createOffer on-success
                    pc.setLocalDescription(
                        desc, // sessionDescription
                        () => { //successCallback
                            iceTimeoutId = setTimeout(()=> {
                                iceTimeoutId = null;
                                console.warn('ICE Candidate timeout, consider as completed.');
                                onIceComplete(this);
                            }, iceTimeout || this._iceTimeout);
                        },
                        errorInfo => { // errorCallback
                            reject(errorInfo);
                        }
                    );
                },
                error => { // createOffer on-error
                    reject(error);
                },
                {offerToReceiveAudio: true, offerToReceiveVideo: false} // createOffer options
            );
        });
    }

    dropCall(call) {
        return new Promise((resolve, reject) => {
            this.request('dropCall', [call.data.cid])
                .then(result => {
                    resolve(result);
                })
                .catch(error => {
                    reject(error);
                });
        });
    }

    answerCall(call, iceTimeout = null) {
        return new Promise((resolve, reject) => {
            let iceTimeoutId = null;
            let offer = new RTCSessionDescription({
                type: 'offer',
                sdp: call.data.remote_sdp
            });
            let pc = new RTCPeerConnection(this._pcConfiguration, this._pcConstraints);
            let onIceComplete = self => {
                self.request('makeCall', [pc.localDescription.sdp, to])
                    .then(callData => {
                        call.pc = pc;
                        resolve();
                    })
                    .catch(error => {
                        reject(error);
                    });
            };
            pc.onaddstream = event => {
                console.log("Add Stream: ", event.stream);
                this._audioPlayer.srcObject = event.stream;
            };
            pc.onremovestream = event => {
                console.log("Remove Stream: ", event.stream);
            };
            pc.addStream(this._localStream);
            pc.onicecandidate = event => {
                if (!event.candidate) {// Local ICE candidate OK!
                    if (iceTimeoutId) {
                        clearTimeout(iceTimeoutId);
                        iceTimeoutId = null;
                        onIceComplete(this);
                    }
                }
            };
            pc.setRemoteDescription(
                offer, // sessionDescription
                () => { // sessionDescription
                    pc.createAnswer(
                        answer => { // createAnswer on-success
                            pc.setLocalDescription(
                                answer, // sessionDescription
                                () => { //successCallback
                                    iceTimeoutId = setTimeout(()=> {
                                        iceTimeoutId = null;
                                        console.warn('ICE Candidate timeout, consider as completed.');
                                        onIceComplete(this);
                                    }, iceTimeout || this._iceTimeout);
                                },
                                errorInfo => { // errorCallback
                                    reject(errorInfo);
                                },
                                {offerToReceiveAudio: true, offerToReceiveVideo: false} // createOffer options
                            );
                        },
                        error => { // createAnswer on-error
                            reject(error);
                        }
                    );
                },
                errorInfo => { // errorCallback
                    reject(errorInfo);
                }
            );
        });
    }

}
