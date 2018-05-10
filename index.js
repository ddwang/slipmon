#!/usr/bin/env node

const figlet = require('figlet');
const package_json = require('./package.json');
const yargs = require('yargs');
const SerialPort = require('serialport');
const chalk = require('chalk');

yargs
	.strict()
	.option('port', {
		alias: 'p',
		describe: 'Serial port, e.g. COM3 or /dev/tty.usbserial',
		required: true,
		type: 'string'
	})
	.option('baudRate', {
		alias: 'b',
		describe: 'Serial port speed, e.g. 115200',
		required: true,
		type: 'number'
	})
	.option('query', {
		alias: 'q',
		describe: 'Highlight certain byte sequences, e.g. A1B2',
		type: 'string'
	})
	.option('raw', {
		alias: 'r',
		describe: 'Display raw (uncolorized) output',
		boolean: true
	})
	.wrap(null)
	.help()
	.usage(figlet.textSync('SLIPMON', { horizontalLayout: 'full' }) + ' (' + package_json.version + ')\n\nUsage: $0 <command>')
	.recommendCommands()
	.argv;

let queryArray = [];

if (typeof yargs.argv.query !== 'undefined') {
	for (let i = 0; i < yargs.argv.query.length - 1; i += 2) {
		queryArray.push(('00' + parseInt(yargs.argv.query.substr(i, 2), 16).toString(16)).substr(-2).toUpperCase());
	}
}
let queryTarget = queryArray.length ?
	queryArray.join(' ') :
	null;

console.log(queryTarget);

let port = new SerialPort(yargs.argv.port, { baudRate: yargs.argv.baudRate });

port.on('open', function() {
	console.log('port opened');
});

let packet = [];
port.on('data', function(data) {
	for (const b of data) {
		let token = ('00' + b.toString(16))
			.substr(-2)
			.toUpperCase();
		packet.push(token);

		if (b === 0xC0) {
			printPacket(packet, queryTarget);
			packet = [];
		}
	}
});

function printPacket(packet, queryTarget) {
	let data = packet.slice();

	for (let i = packet.length - 1; i >= 0; i--) {
		let token = packet[i];

		if (token === 'C0' && i === packet.length - 1) {
			data.splice(i, 1);
			packet[i] = chalk.cyan('END');
		}
		if (token === 'DB') {
			if (i === 0) {
				data.splice(i, 1);
				packet[i] = chalk.cyan('ESC');

			} else if (i < (packet.length - 1)) {
				data.splice(i, 1);
				packet.splice(i, 1);

				if (packet[i] === 'DC') {
					data[i] = 'C0';
					packet[i] = chalk.bold('C0');

				} else if (packet[i] === 'DD') {
					data[i] = 'DB';
					packet[i] = chalk.bold('DB');

				} else {
					packet[i] = chalk.red('ERROR:' + packet[i]);

				}
			}
		}
	}

	if (queryTarget) {
		let k = data
			.join(' ')
			.indexOf(queryTarget);
		if (k >= 0) {
			for (let i = k / 3 + 1; i <= (k + queryTarget.length) / 3 + 1; i++) {
				packet[i] = chalk.red(packet[i]);
			}
		}
	}
	console.log(packet.join(' '));
}
