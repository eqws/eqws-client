const Socket = require('../');

const client = new Socket({
	url: 'ws://localhost:3000'
});

client.on('connected', () => {
	client.emit('test', {work: true});
});

client.on('test', function() {
	console.log(arguments);
});