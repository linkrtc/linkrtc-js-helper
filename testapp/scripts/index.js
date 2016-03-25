(function() {
  'use strict';

  var c = null;
  var sdp = '';

  document.querySelector('button#getSDP').onclick = getSDP;

  document.querySelector('button#close').onclick = close;

  document.querySelector('button#InitClient').onclick = () => {
    let wsUrl = 'ws://192.168.56.102:8080/capi/1?password=1';
    console.debug(`Connect ${wsUrl}...`);
    c = new LinkRtcClient(wsUrl);
    c.connect()
      .then(() => {
        console.debug('Connected!');
        let rtcConfig = {
          iceServers: [{
            urls: ["stun:stun.web2sip.hes86.net"]
          }],
          iceTransportPolicy: 'all',
        };
        console.debug('prepareRtc ...');
        c.prepareRtc(rtcConfig)
          .then(() => {
            console.debug('prepareRtc: OK!');
          })
          .catch(error => {
            console.log('prepareRtc: ', error)
          });
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
  }

  document.querySelector('button#delayEcho').onclick = () => {
    c.request('delayEcho', ['hello', 3000])
      .then(result => {
        console.log('delayEcho:', result);
      })
      .catch(error => {
        console.error('echo:', error);
      });
  }

  var call = null;

  document.querySelector('button#makeCall').onclick = () => {
    console.log('makeCall ...');
    c.makeCall(
        'sip:192.168.56.1',
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
        console.log(`makeCall => cid=${result.cid}`);
        call = result;
      })
      .catch(error => {
        console.error('makeCall err:', error);
      });
  }

  document.querySelector('button#dropCall').onclick = () => {
    console.log(`dropCall (cid=${call.cid})...`);
    c.dropCall(call)
      .then(result => {
        console.log('dropCall => ', result);
      })
      .catch(error => {
        console.error('makeCall err:', error);
      });
  }

  var pc;
  var pcConfigs = {
    iceServers: [{
      urls: ["stun:stun.web2sip.hes86.net"]
    }],
    iceTransportPolicy: 'all'
  };
  var pcConstraints = {};

  var mediaOptions = {
    audio: true,
    video: false
  };

  var offerOptions = {
    offerToReceiveAudio: true,
    offerToReceiveVideo: false,
  };

  var errorHandler = function(err) {
    console.error(err);
  };

  function getSDP() {
    navigator.getUserMedia(
      // navigator.getUserMedia options
      mediaOptions,
      // navigator.getUserMedia on-success
      stream => {
        console.log('Creating new PeerConnection with config=' + JSON.stringify(pcConfigs) + ', constraints=' + JSON.stringify(pcConstraints));
        pc = new RTCPeerConnection(pcConfigs, pcConstraints);
        pc.addStream(stream);
        pc.onsignalingstatechange = ev => {
          // console.log("onsignalingstatechange event detected: ", ev);
        };
        pc.oniceconnectionstatechange = ev => {
          // console.log("oniceconnectionstatechange event detected: ", ev);
        };
        //
        pc.onicecandidate = ev => {
          // console.log('onicecandidate: ', ev);
          if (!event.candidate) {
            // Again crate offer, after ICE OK
            pc.createOffer(
              desc => {
                console.log(desc.sdp);
                pc.setLocalDescription(desc);
                sdp = desc.sdp;
              },
              error => {
                console.log('Error creating offer: ', error);
              },
              offerOptions
            );
          }
        };
        //
        console.log('pc.createOffer ...');
        pc.createOffer(
          // createOffer on-success
          desc => {
            console.log('pc.createOffer [OK]');
            pc.setLocalDescription(desc);
          },
          // createOffer on-error
          error => {
            console.error('RTCPeerConnection::createOffer()', error);
          },
          // createOffer options
          offerOptions
        );
      },
      // navigator.getUserMedia on-error
      error => {
        console.error('navigator.getUserMedia()', error)
      }
    );
    // navigator.getUserMedia END
  }

  function close() {
    pc.close();
    pc = null;
  }

})();
