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
  constructor(data, onAnswer = null, onRelease = null, onStateChange = null) {
    this._data = data;
    this._onAnswer = onAnswer;
    this._onRelease = onRelease;
    this._onStateChange = onStateChange;
  }

  get data() {
    return this._data;
  }
}


class LinkRtcClient {
  constructor(url) {
    this._url = url;
    this._webSocket = null;
    this._pendingRequests = {};
    this._calls = {};
    this._pc = null;
  }

  _popPendingRequest(requestID) {
    let pendingRequest = this._pendingRequests[requestID];
    if (pendingRequest) {
      delete this._pendingRequests[requestID];
    }
    return pendingRequest === undefined ? null : pendingRequest;
  }

  static makeID() {
    return (Date.now().toString(36) + Math.random().toString(36).substr(2, 5)).toUpperCase();
  }

  get url() {
    return this._url;
  }

  get webSocket() {
    return this._webSocket;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this._webSocket = new WebSocket(this._url);
      this._webSocket.onmessage = message => {
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
            let remoteSdp = data.params[1];
            let call = this._calls[cid];
            if (call)
              if (call._onAnswer)
                call._onAnswer(remoteSdp);
          } else if (data.method == 'onCallReleased') {
            let cid = data.params[0];
            let call = this._calls[cid];
            delete this._calls[cid];
            if (call)
              if (call._onRelease)
                call._onRelease();
          } else if (data.method == 'onCallStateChanged') {
            let cid = data.params[0];
            let state = data.params[1];
            let call = this._calls[cid];
            if (call)
              if (call._onStateChange)
                call._onStateChange(state);
          } else {
            throw new Error(`unknown method ""${data.method}`);
          }
        }
      };
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

  request(method, params = [], timeout = 30000) {
    return new Promise((resolve, reject) => {
      let requestID = LinkRtcClient.makeID();
      let timeoutID = null;
      let data = {
        jsonrpc: '2.0',
        id: requestID,
        method: method.toString(),
        params: params,
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
        timeoutID: timeoutID,
      };
    });
  }

  makeCall(to, onAnswer = null, onRelease = null, onStateChange = null) {
    to = String(to || '');
    return new Promise((resolve, reject) => {
      this.request('makeCall', [this._pc.localDescription.sdp, to])
        .then(callData => {
          let call = this._calls[callData.cid] = new LinkRtcCall(callData, onAnswer, onRelease, onStateChange);
          resolve(call);
        })
        .catch(error => {
          reject(error);
        });
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

  prepareRtc(configuration, constraints={}) {
    return new Promise((resolve, reject) => {
      let pcConstraints = {};
      let mediaOptions = {
        audio: true,
        video: false
      };
      let offerOptions = {
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      };
      let pc = null;
      navigator.getUserMedia(
        mediaOptions, // navigator.getUserMedia options
        stream => { // navigator.getUserMedia on-success
          pc = this._pc = new RTCPeerConnection(configuration, constraints);
          pc.addStream(stream);
          pc.onicecandidate = ev => {
            if (!event.candidate) { // Again crate offer, after ICE OK
              pc.createOffer(
                desc => {
                  pc.setLocalDescription(desc);
                  resolve();
                },
                error => {
                  reject(error);
                },
                offerOptions
              );
            }
          };
          pc.createOffer(
            desc => { // createOffer on-success
              pc.setLocalDescription(desc);
            },
            error => { // createOffer on-error
              reject(error);
            },
            offerOptions // createOffer options
          );
        },
        error => { // navigator.getUserMedia on-error
          reject(error);
        }
      );
    });
  }

}
