(function () {
    'use strict';

    var c = null;

    document.querySelector('button#getSDP').onclick = getSDP;

    document.querySelector('button#close').onclick = close;

    document.querySelector('button#InitClient').onclick = () => {
        let wsUrl = 'ws://120.25.73.183:58080/capi/1?password=1';
        console.debug(`Connect ${wsUrl}...`);
        c = new LinkRtcClient(wsUrl);

        let rtcConfig = {
            iceServers: [{
                urls: ["stun:stun.web2sip.hes86.net"]
            }],
            iceTransportPolicy: 'all'
        };
        console.debug('prepareRtc ...');
        c.prepareRtc(rtcConfig)
            .then(() => {
                console.debug('prepareRtc: OK!');
            })
            .catch(error => {
                console.log('prepareRtc: ', error)
            });

        c.connect()
            .then(() => {
                console.debug('Connected!');
            })
            .catch(error => {
                console.error('connect:', error);
            });
    };

    document.querySelector('button#echo').onclick = () => {
        c.request('echo', ['hello'])
            .then(result => {
                console.log('echo:', result);
            })
            .catch(error => {
                console.error('echo:', error);
            });
    };

    document.querySelector('button#delayEcho').onclick = () => {
        c.request('delayEcho', ['hello', 3000])
            .then(result => {
                console.log('delayEcho:', result);
            })
            .catch(error => {
                console.error('echo:', error);
            });
    };

    var call = null;

    document.querySelector('button#makeCall').onclick = () => {
        console.log('makeCall ...');
        c.makeCall(
            'sip:user1@sip.web2sip.hes86.net',
            remoteSdp => {
                console.log('onAnswer: ', remoteSdp);
            },
            () => {
                console.log('onRelease: ');
            },
            state => {
                console.log('onStateChange: ', state);
            }
            )
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
        c.dropCall(call)
            .then(result => {
                console.log('dropCall => ', result);
            })
            .catch(error => {
                console.error('makeCall err:', error);
            });
    };

})();
