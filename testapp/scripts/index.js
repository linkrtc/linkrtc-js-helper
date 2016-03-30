(function () {
    'use strict';

    var client = null;
    var call = null;

    document.querySelector('button#new').onclick = () => {
        let wsUrl = 'ws://120.25.73.183:58080/capi/18602015268?password=123';
        console.log(`new Client at ${wsUrl}`);
        client = new LinkRtcClient({
            url: wsUrl,
            pcConfiguration: {
                iceServers: [{
                    urls: ["stun:stun.linkrtc.com"]
                }],
                iceTransportPolicy: 'all'
            },
            audioPlayer: document.querySelector('audio#remoteAudio'),
            onCallIncoming: _call => {
                call = _call;
                console.log(`CallIncoming: ${call}`);
            },
            onCallAnswer: call => {
                console.log(`[${call.data.cid}] Answer`);
            },
            onCallRelease: call => {
                console.log(`[${call.data.cid}] Release`);
            },
            onCallStateChange: (call, priorState, currentState) => {
                console.log(`[${call.data.cid}] StateChange ${priorState} --> ${currentState}`);
            }
        });
        console.log(`connect object = ${client}`)
    };

    document.querySelector('button#setLocalAudioStream').onclick = () => {
        client.setLocalAudioStream()
            .then(() => {
                console.debug('setLocalAudioStream OK!');
            })
            .catch(error => {
                console.error('setLocalAudioStream error:', error);
            });
    };

    document.querySelector('button#connect').onclick = () => {
        client.connect()
            .then(() => {
                console.debug('web-socket connected!');
            })
            .catch(error => {
                console.error('web-socket connect error:', error);
            });
    };

    document.querySelector('button#answerCall').onclick = () => {
        console.log('answerCall ...');
        client.answerCall(call, 5000)
            .then(result => {
                call = result;
                console.log(`answerCall OK`);
            })
            .catch(error => {
                console.error('answerCall err:', error);
            });
    };

    document.querySelector('button#makeCall').onclick = () => {
        console.log('makeCall ...');
        client.makeCall('user1', 5000)
            .then(result => {
                call = result;
                console.log(`makeCall => cid=${result.data.cid}`);
            })
            .catch(error => {
                console.error('makeCall err:', error);
            });
    };

    document.querySelector('button#dropCall').onclick = () => {
        console.log(`dropCall (cid=${call.data.cid})...`);
        client.dropCall(call)
            .then(result => {
                console.log('dropCall => ', result);
            })
            .catch(error => {
                console.error('dropCall error:', error);
            });
    };


    document.querySelector('button#echo').onclick = () => {
        client.request('echo', ['hello'])
            .then(result => {
                console.log('echo:', result);
            })
            .catch(error => {
                console.error('echo:', error);
            });
    };

    document.querySelector('button#delayEcho').onclick = () => {
        client.request('delayEcho', ['hello', 3000])
            .then(result => {
                console.log('delayEcho:', result);
            })
            .catch(error => {
                console.error('echo:', error);
            });
    };

})();
