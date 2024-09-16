const socket = io.connect(window.location.origin);

let transport;
let consumer;

socket.on('connect', () => {
    socket.emit('createTransport', async ({ id, iceParameters, iceCandidates, dtlsParameters, sctpParameters }) => {
        transport = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });

        // Set up the transport
        await transport.setRemoteDescription({ type: 'offer', sdp: iceParameters });
        await transport.addIceCandidate(iceCandidates);
        await transport.setLocalDescription(dtlsParameters);

        // Consume the media
        socket.emit('consume', {
            producerId: 'producer-id', // Replace with actual producer ID
            rtpCapabilities: {
                codecs: [{ mimeType: 'video/VP8', payloadType: 96 }]
            }
        });
    });
});

socket.on('consume', async ({ id, producerId, kind, rtpParameters }) => {
    consumer = await transport.consume({
        producerId,
        rtpCapabilities,
        paused: false
    });

    // Add the received track to the video element
    const stream = new MediaStream();
    stream.addTrack(consumer.track);
    document.querySelector('video').srcObject = stream;

    await consumer.resume();
});
