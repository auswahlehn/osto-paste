const { execFile } = require('child_process');

// Toolbox does not ship electron to mods, so read the clipboard through
// PowerShell instead. Electron is still used when it happens to be there.
let electronClipboard = null;
try { electronClipboard = require('electron').clipboard || null; } catch (e) {}

const PS_SCRIPT = '[Console]::OutputEncoding=[Text.Encoding]::UTF8;$t=Get-Clipboard -Raw;if($t){[Console]::Out.Write($t)}';

function readClipboard(callback) {
	if (electronClipboard) {
		callback(null, electronClipboard.readText());
		return;
	}
	execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-STA', '-Command', PS_SCRIPT],
		{ windowsHide: true, timeout: 5000, encoding: 'utf8' },
		(err, stdout) => callback(err, err ? '' : stdout));
}

module.exports = function paste(mod) {
	const command = mod.command;
	let enabled = true;

	// Runs fn with the clipboard text, cleaned up for one chat line.
	function withClipboard(fn) {
		if (!enabled) return;
		readClipboard((err, text) => {
			if (err) {
				command.message('Could not read the clipboard.');
				mod.error(err);
				return;
			}
			text = String(text || '').replace(/\r?\n|\r/g, ' ').trim();
			if (text === '') {
				command.message('Clipboard is empty.');
				return;
			}
			fn(text);
		});
	}

	command.add(['paste', '!paste'], {
		$none() {
			enabled = !enabled;
			command.message('Paste mod ' + (enabled ? 'Enabled' : 'Disabled') + '.');
		},
		$default() {
			command.message('Invalid command! see README for the list of valid commands');
		},
		test() { withClipboard(text => command.message(escapeHtml(text))); },
		s() { withClipboard(text => sendMessage(text, 0)); },
		p() { withClipboard(text => sendMessage(text, 1)); },
		g() { withClipboard(text => sendMessage(text, 2)); },
		pn() { withClipboard(text => sendMessage(text, 21)); },
		in() { withClipboard(text => sendMessage(text, 25)); },
		c() { withClipboard(text => sendMessage(text, 27)); },
		i() { withClipboard(text => sendMessage(text, 32)); },
		w(arg) {
			if (!arg) {
				command.message('Usage: paste w PlayerName');
				return;
			}
			withClipboard(text => sendWhisper(text, arg));
		}
	});

	/* say = 0, party = 1, guild = 2, area = 3, trade = 4, greet = 9,
	* private = 11-18, p-notice = 21, emote = 26, global = 27, r-notice = 25,
	* raid = 32, megaphone = 213, guild-adv = 214 */
	function sendMessage(msg, chan) {
		mod.toServer('C_CHAT', 1, {
			channel: chan,
			message: '<FONT>' + escapeHtml(msg) + '</FONT>'
		});
	}

	function sendWhisper(msg, target) {
		if (!isValidName(target)) {
			command.message('Invalid player name.');
			return;
		}
		mod.toServer('C_WHISPER', 1, {
			target: target,
			message: '<FONT>' + escapeHtml(msg) + '</FONT>'
		});
	}

	function isValidName(string) {
		return /^[^\s<>&]+$/.test(string);
	}

	function escapeHtml(s) {
		return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}
};
