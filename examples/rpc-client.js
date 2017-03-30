const Socket = require('../');

const client = new Socket({
	url: 'ws://localhost:3000'
});

client.call('system.ping', (err, result) => {
	if (err) return console.error(err);

	console.log(result);
});