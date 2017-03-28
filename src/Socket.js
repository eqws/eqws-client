const EventEmitter = require('eventemitter3');
const debug        = require('debug')('eqws-client:socket');
const error        = require('debug')('eqws-client:socket:error');
const Protocol     = require('../../eqws-protocol');
const Packet       = Protocol.Packet;
const C            = Protocol.C;

const CONNECTION_TIMEOUT = 1000;
const WS_ENGINE = global.WebSocket || global.MozWebSocket || require('ws');

const emit = EventEmitter.prototype.emit;

class Socket extends EventEmitter {
	constructor(opts) {
		super();

		// Define default opts
		if (!opts.url) opts.url = '/';
		if (!opts.protocol) opts.protocol = 'ws';

		// Detect domain
		if (global.window) {
			let f = opts.url.charAt(0);

			if (f === '/' || f === ':') {
				opts.url = `${opts.protocol}://${window.location.hostname}${opts.url}`;
			}
		}

		// Initialize socket
		this._options = opts;
		this._socket = null;
		this._reconnectionTimeout = CONNECTION_TIMEOUT;
		this._initializeSocket();
	}

	reconnect() {
		if (this._socket) {
			this._socket.onclose = null;
			this._socket.onmessage = null;
			this._socket.onopen = null;
			this._socket.close();
			this._initializeSocket();
		} else {
			this._initializeSocket();
		}
	}

	send(data) {
		if (data instanceof Packet) {
			this._sendPacket(data);
		} else {
			const packet = new Packet(C.PACKET_TYPES.MESSAGE, args);
			this._sendPacket(packet);
		}
	}

	emit(e) {
		if (~C.IMPORTANT_EVENTS.indexOf(e)) {
			return debug('emit important event=%s', e);
		}

		const args = Array.prototype.slice.call(arguments);
		const packet = new Packet(C.PACKET_TYPES.EVENT, args);

		this._sendPacket(packet);
	}

	_sendPacket(packet) {
		const data = packet.encode();
		this._send(data);
	}

	_send(data) {
		if (this._socket && this._socket.readyState === WS_ENGINE.OPEN) {
			this._socket.send(data, false);
		} else {
			setTimeout(this._send.bind(this, data), 5);
		}
	}

	_initializeSocket() {
		try {
			this._socket = new WS_ENGINE(this._options.url);
			this._socket.binaryType = 'arraybuffer';
			this._socket.onmessage = this._onMessage.bind(this);
			this._socket.onclose = this._onClose.bind(this);
			this._socket.onopen = this._onOpen.bind(this);
		} catch (err) {
			this._onError(err);
		}
	}

	_onMessage(msg) {
		debug('received message size=%d', msg.data.length || msg.data.byteLength);

		try {
			const packet = Packet.parse(msg.data);
			debug('parsed packet=%d', packet.type, packet.data);

			if (!packet.isValid()) {
				return debug('received invalid packet');
			}

			switch (packet.type) {
				case C.PACKET_TYPES.MESSAGE:
					emit.call(this, 'message', packet.data);
					break;

				case C.PACKET_TYPES.EVENT:
					emit.apply(this, packet.data);
					break;
			}

			emit.call(this, 'packet', packet);
		} catch (err) {
			this._onError(err);
		}
	}

	_onClose() {
		debug('socket connection close: reconnect %dms', this._reconnectionTimeout);
		setTimeout(() => this._initializeSocket(), this._reconnectionTimeout);

		this._reconnectionTimeout += CONNECTION_TIMEOUT;
		emit.call(this, 'disconnect');
	}

	_onOpen() {
		this._reconnectionTimeout = CONNECTION_TIMEOUT;
		emit.call(this, 'connected');
	}

	_onError(err) {
		error(err);
		emit.call(this, 'error', err);
	}
}

module.exports = Socket;