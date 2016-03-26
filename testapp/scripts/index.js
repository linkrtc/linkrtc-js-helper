(function () {
    'use strict';

    var client = null;
    var call = null;

    document.querySelector('button#connect').onclick = () => {
        let wsUrl = 'ws://120.25.73.183:58080/capi/1?password=1';
        console.debug(`Connect ${wsUrl}...`);
        client = new LinkRtcClient(wsUrl);
        client.connect()
            .then(() => {
                console.debug('web-socket connected!');
            })
            .catch(error => {
                console.error('web-socket connect error:', error);
            });
    };

    document.querySelector('button#makeCall').onclick = () => {
        console.log('makeCall ...');
        client.makeCall({
                toUrl: 'sip:user1@sip.web2sip.hes86.net',
                configuration: {
                    iceServers: [{
                        urls: ["stun:stun.web2sip.hes86.net"]
                    }],
                    iceTransportPolicy: 'all'
                },
                onAnswer: call => {
                    console.log(`[${call.data.cid}] Answer`);
                },
                onRelease: call => {
                    console.log(`[${call.data.cid}] Release`);
                },
                onStateChange: (call, priorState, currentState) => {
                    console.log(`[${call.data.cid}] StateChange ${priorState} --> ${currentState}`);
                }
            })
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
