#!/usr/bin/env node

'use strict';

const figlet = require('figlet');
const package_json = require('./package.json');
const yargs = require('yargs');
const SerialPort = require('serialport');
const chalk = require('chalk');

yargs
	.strict()
	.option('port X', {
		alias: 'x',
		describe: 'Y Serial port, e.g. COM3 or /dev/tty.usbserial',
		required: true,
		type: 'string'
	})
	.option('port Y', {
		alias: 'y',
		describe: 'Y Serial port, e.g. COM4 or /dev/tty.usbserial',
		required: true,
		type: 'string'
	})
	.option('baudRate', {
		alias: 'b',
		describe: 'Serial port speed, e.g. 115200',
		required: true,
		type: 'number',
		default: 115200
	})
	.wrap(null)
	.help()
	.usage(figlet.textSync('SLIPROXY', { horizontalLayout: 'full' }) + ' (' + package_json.version + ')\n\nUsage: $0 <command>')
	.recommendCommands()
	.argv;

let packet = [];
let is_printable = true;

exports.command = 'proxy';
exports.desc = false;
exports.builder = function() {
	return;
};
exports.handler = (argv) => {
	let port = new SerialPort(argv.port, {
		baudRate: argv.baudRate
	});

	port.on('open', function() {
		console.log('port opened');
	});

	port.on('data', function(data) {
		for (const b of data) {
			if (b > 0x7E) {
				is_printable = false;
			}
			packet.push(b);

			if (b === 0xC0) {
				let serial_array = packet.map(function(x) {
					let token = ('00' + x.toString(16))
						.substr(-2)
						.toUpperCase();
					return token;
				});

				printPacket(serial_array);
				port.write(packet);
				packet = [];
				is_printable = true;
			}

			if (b === 10 && is_printable) {
				let debug_str = packet //
					.filter((x) => {
						return x != 10;
					})
					.map(function(x) {
						let token = String.fromCharCode(x);
						return token;
					});

				console.log(debug_str.join(''));
				packet = [];
				is_printable = true;
			}
		}
	});
};

function printPacket(packet) {
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

	console.log(packet.join(' '));
}