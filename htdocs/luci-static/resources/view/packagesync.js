'use strict';
'require view';
'require poll';
'require fs';
'require uci';
'require ui';
'require form';

return view.extend({
//	handleSaveApply: null,
//	handleSave: null,
//	handleReset: null,

	load: function() {
	return Promise.all([
		L.resolveDefault(fs.read('/var/packagesync/releaseslist'), null),
		L.resolveDefault(fs.exec('/etc/init.d/packagesync', ['checkln']), {}),
		uci.load('packagesync'),
	]);
	},

	render: function(res) {
		var releaseslist = res[0] ? res[0].trim().split("\n") : [],
			usedname = res[1],
			mntpkgs = '/mnt/packagesync';

		var m, s, o;

		m = new form.Map('packagesync');

		s = m.section(form.TypedSection, 'packagesync', _('Local software source'),
			_('packagesync used to build a local mirror feeds source on the router<br/>\
			To use packagesync, you need to prepare a storage device with a size of at least <b>16G</b> and connect it to the router<br/>\
			then open <a href="%s"><b>Mount Points</b></a>, find the connected device and set its mount point to <b>%s</b>, check <b>Enabled</b> and click <b>Save&Apple</b>')
			.format(L.url('admin', 'system', 'mounts'), mntpkgs));
		s.anonymous = true;

		o = s.option(form.Value, 'home_url', _('Home URL'));
		o.placeholder = 'packagesync';
		o.rmempty = false;

		o = s.option(form.Button, '_exec_now', _('Execute'));
		o.inputtitle = _('Execute');
		o.inputstyle = 'apply';
		o.onclick = function() {
			window.setTimeout(function() {
				window.location = window.location.href.split('#')[0];
			}, L.env.apply_display * 1000);

			return fs.exec('/etc/init.d/packagesync', ['start'])
				.catch(function(e) { ui.addNotification(null, E('p', e.message), 'error') });
		};

		o = s.option(form.Flag, 'auto_exec', _('Auto Exec'));
		o.default = o.enabled;
		o.rmempty = false;

		o = s.option(form.Value, 'cron_expression', _('Cron expression'),
			_('The default value is 0:00 every day'));
		o.default = '0 0 * * *';
		o.placeholder = '0 0 * * *';
		o.rmempty = false;
		o.depends('auto_exec', '1');
		o.retain = true;

		o = s.option(form.Flag, 'proxy_enabled', _('Enable proxy'));
		o.rmempty = false;

		o = s.option(form.ListValue, 'proxy_protocol', _('Proxy Protocol'));
		o.value('http', 'HTTP');
		o.value('https', 'HTTPS');
		o.value('socks5', 'SOCKS5');
		o.value('socks5h', 'SOCKS5H');
		o.default = 'socks5';
		o.rmempty = false;
		o.depends('proxy_enabled', '1');
		o.retain = true;

		o = s.option(form.Value, 'proxy_server', _('Proxy Server'));
		o.datatype = "ipaddrport(1)";
		o.placeholder = '192.168.1.10:1080';
		o.rmempty = false;
		o.depends('proxy_enabled', '1');
		o.retain = true;

		s = m.section(form.GridSection, 'release', _('Mirror Releases'));
		s.sortable  = true;
		s.anonymous = true;
		s.addremove = true;

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.default = o.enabled;
		o.editable = true;
		o.rmempty = false;

		o = s.option(form.Value, 'version', _('Version'));
		o.rmempty = false;

		o = s.option(form.Value, 'target', _('Target'));
		o.value('x86');
		o.value('ath79');
		o.value('ar71xx');
		o.rmempty = false;
		o.validate = function(section, value) {
			if (value == null || value == '')
				return _('Expecting: non-empty value');
			return true;
		};

		o = s.option(form.Value, 'subtarget', _('SubTarget'));
		o.value('64');
		o.value('generic');
		o.value('nand');
		o.rmempty = false;
		o.validate = function(section, value) {
			if (value == null || value == '')
				return _('Expecting: non-empty value');
			return true;
		};

		o = s.option(form.Value, 'pkgarch', _('Arch'));
		o.value('x86_64');
		o.value('mips_24kc');
		o.rmempty = false;
		o.validate = function(section, value) {
			if (value == null || value == '')
				return _('Expecting: non-empty value');
			return true;
		};

		return m.render();
	}
});
