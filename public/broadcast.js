const socket = io.connect(window.location.origin);

let transport;
let producer;
let localStream;

async function start() {
    // Request the creation of a WebRTC transport
    socket.emit('createTransport', async ({ id, iceParameters, iceCandidates, dtlsParameters, sctpParameters }) => {
        transport = new window.RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });

        // Set up the transport
        await transport.setRemoteDescription({ type: 'offer', sdp: iceParameters });
        await transport.addIceCandidate(iceCandidates);
        await transport.setLocalDescription(dtlsParameters);

        // Add tracks from local stream to the transport
        localStream.getTracks().forEach(track => transport.addTrack(track, localStream));

        // Produce the stream
        producer = await transport.produce({
            kind: 'video', // 'video' or 'audio'
            rtpParameters: {
                codecs: [{ mimeType: 'video/VP8', payloadType: 96 }]
            }
        });

        socket.emit('produce', {
            transportId: transport.id,
            kind: producer.kind,
            rtpParameters: producer.rtpParameters
        });
    });
}

// Get user media
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
        localStream = stream;
        document.querySelector('video').srcObject = stream;
        start();
    })
    .catch(error => console.error('Error accessing media devices.', error));
