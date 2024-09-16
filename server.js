const express = require('express');
const https = require('https');
const socketIo = require('socket.io');
const mediasoup = require('mediasoup');

const privateKey = fs.readFileSync('/etc/letsencrypt/live/irc.chateachat.com/privkey.pem', 'utf8');
const certificate = fs.readFileSync('/etc/letsencrypt/live/irc.chateachat.com/fullchain.pem', 'utf8');
const credentials = { key: privateKey, cert: certificate };
const server = https.createServer(credentials, app);

const app = express();
const io = socketIo(server);



const port = 4000;

let worker, router;
let transports = {};
let producers = {};
let consumers = {};

async function startMediasoup() {
    worker = await mediasoup.createWorker({
        logLevel: 'debug',
        logTags: ['info', 'warn', 'error'],
    });

    router = await worker.createRouter({
        mediaCodecs: [
          
            { kind: 'video', mimeType: 'video/VP8', clockRate: 90000 },
        ],
    });
}

startMediasoup();

// Serve static files from the 'public' directory
app.use(express.static(__dirname + '/public'));

io.on('connection', (socket) => {
    socket.on('createTransport', async (callback) => {
        const transport = await router.createWebRtcTransport({
            listenIps: [{ ip: '0.0.0.0', announcedIp: null }],
            enableUdp: true,
            enableTcp: true,
            preferUdp: true,
        });

        transports[socket.id] = transport;

        callback({
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
            sctpParameters: transport.sctpParameters,
        });
    });

    socket.on('connectTransport', async ({ transportId, dtlsParameters }) => {
        const transport = transports[transportId];
        await transport.connect({ dtlsParameters });
    });

    socket.on('produce', async ({ transportId, kind, rtpParameters }, callback) => {
        const transport = transports[transportId];
        const producer = await transport.produce({ kind, rtpParameters });
        producers[producer.id] = producer;
        callback({ id: producer.id });
    });

    socket.on('consume', async ({ producerId, rtpCapabilities }, callback) => {
        if (!router.canConsume({ producerId, rtpCapabilities })) {
            return callback({ error: 'cannot consume' });
        }

        const transport = await router.createWebRtcTransport({
            listenIps: [{ ip: '0.0.0.0', announcedIp: null }],
            enableUdp: true,
            enableTcp: true,
            preferUdp: true,
        });

        const consumer = await transport.consume({
            producerId,
            rtpCapabilities,
            paused: true,
        });

        consumers[consumer.id] = consumer;

        callback({
            id: consumer.id,
            producerId: consumer.producerId,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
        });
    });

    socket.on('resume', async ({ consumerId }) => {
        const consumer = consumers[consumerId];
        await consumer.resume();
    });

    socket.on('disconnect', () => {
        // Clean up logic if needed
    });
});
