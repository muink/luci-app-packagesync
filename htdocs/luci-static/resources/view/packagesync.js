'use strict';
'require view';
'require poll';
'require fs';
'require uci';
'require ui';
'require dom';
'require form';

var mntpkgs = '/mnt/packagesync';
var mntreg = RegExp(/\/mnt\/packagesync/);

return view.extend({
//	handleSaveApply: null,
//	handleSave: null,
//	handleReset: null,

	load: function() {
	return Promise.all([
		L.resolveDefault(fs.read('/var/packagesync/releaseslist'), null),
		L.resolveDefault(fs.exec('/etc/init.d/packagesync', ['checkln']), {}),
		L.resolveDefault(fs.exec('/bin/df', ['-hT']), {}),
		uci.load('packagesync'),
	]);
	},

	render: function(res) {
		var releaseslist = res[0] ? res[0].trim().split("\n") : [],
			usedname = res[1].stdout ? res[1].stdout.trim().split("\n") : [],
			storages = res[2].stdout ? res[2].stdout.trim().split("\n") : [];

		var storage = [];
		if (storages.length) {
			for (var i = 1; i < storages.length; i++) {
				if (storages[i].match(mntreg)) {
					storage = storages[i].trim().split(/\s+/, 7);
					break;
				}
			}
		};

		var m, s, o;

		m = new form.Map('packagesync');

		s = m.section(form.TypedSection, 'packagesync', _('Local software source'),
			_('packagesync used to build a local mirror feeds source on the router<br/>\
			To use packagesync, you need to prepare a storage device with a size of at least <b>16G</b> and connect it to the router<br/>\
			then open <a href="%s"><b>Mount Points</b></a>, find the connected device and set its mount point to <b>%s</b>, check <b>Enabled</b> and click <b>Save&Apple</b>')
			.format(L.url('admin', 'system', 'mounts'), mntpkgs));
		s.anonymous = true;

		o = s.option(form.Value, 'home_url', _('Home URL'),
			_('Open <a href="/%s">URL</a>').format(uci.get('packagesync', '@packagesync[0]', 'home_url')));
		o.placeholder = 'packagesync';
		o.rmempty = false;
		o.validate = function(section, value) {
			if (value == null || value == '')
				return _('Expecting: non-empty value');
        
			for (var i = 0; i < usedname.length; i++)
				if (usedname[i] == value)
					return _('The Name %h is already used').format(value);
        
			return true;
		};
		o.write = function(section, value) {
			uci.set('packagesync', section, 'home_url', value);
			fs.exec('/etc/init.d/packagesync', ['symln', value]);
		};

		o = s.option(form.Button, '_exec_now', _('Execute'));
		o.inputtitle = _('Execute');
		o.inputstyle = 'apply';
		if (! storage.length)
			o.readonly = true;
		o.onclick = function() {
			window.setTimeout(function() {
				window.location = window.location.href.split('#')[0];
			}, L.env.apply_display * 1000);

			return fs.exec('/etc/init.d/packagesync', ['start'])
				.catch(function(e) { ui.addNotification(null, E('p', e.message), 'error') });
		};

		o = s.option(form.ListValue, 'bwlimit', _('Bandwidth Limit'));
		o.value('0', _('Unlimited'));
		o.value('100', _('100 KB/s'));
		o.value('200', _('200 KB/s'));
		o.value('300', _('300 KB/s'));
		o.value('500', _('500 KB/s'));
		o.value('1000', _('1 MB/s'));
		o.value('2000', _('2 MB/s'));
		o.value('3000', _('3 MB/s'));
		o.value('5000', _('5 MB/s'));
		o.value('10000', _('10 MB/s'));
		o.value('20000', _('20 MB/s'));
		o.value('30000', _('30 MB/s'));
		o.value('50000', _('50 MB/s'));
		o.default = '500';
		o.rmempty = false;

		o = s.option(form.Flag, 'auto_exec', _('Auto Exec'));
		o.default = o.enabled;
		o.rmempty = false;
		o.write = function(section, value) {
			uci.set('packagesync', section, 'auto_exec', value);
			if (value == 1) {
				fs.exec('/etc/init.d/packagesync', ['setcron', uci.get('packagesync', '@packagesync[0]', 'cron_expression')]);
			} else {
				fs.exec('/etc/init.d/packagesync', ['setcron']);
			}
		};

		o = s.option(form.Value, 'cron_expression', _('Cron expression'),
			_('The default value is 0:00 every day'));
		o.default = '0 0 * * *';
		o.placeholder = '0 0 * * *';
		o.rmempty = false;
		o.depends('auto_exec', '1');
		o.retain = true;
		o.write = function(section, value) {
			uci.set('packagesync', section, 'cron_expression', value);
			fs.exec('/etc/init.d/packagesync', ['setcron', value]);
		};
		o.remove = function(section, value) {
			//uci.unset('packagesync', section, 'cron_expression');
			fs.exec('/etc/init.d/packagesync', ['setcron']);
		};

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

		o = s.option(form.Button, '_list_invalid', _('List removable versions'));
		o.inputtitle = _('List');
		o.inputstyle = 'apply';
		if (! storage.length)
			o.readonly = true;
		o.onclick = function(ev, section_id) {
			let precontent = document.getElementById('cleanup-output');

			return fs.exec('/etc/init.d/packagesync', ['cleanup'])
				.then(function(res) { dom.content(precontent, [ res.stdout.trim().length ? res.stdout.trim() : _('no objects need to remove.'), res.stderr ? res.stderr : '' ]) })
				.catch(function(err) { ui.addNotification(null, E('p', err.message), 'error') });
		};

		o = s.option(form.DummyValue, '_removable_versions', ' ');
		o.rawhtml = true;
		o.cfgvalue = function(section_id) {
			return E('pre', { 'id': 'cleanup-output' }, []);
		};

		s = m.section(form.GridSection, '_storage');

		s.render = L.bind(function(view, section_id) {
			var table = E('table', { 'class': 'table cbi-section-table', 'id': 'storage_device' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, _('Filesystem')),
					E('th', { 'class': 'th' }, _('Type')),
					E('th', { 'class': 'th' }, _('Size')),
					E('th', { 'class': 'th' }, _('Used')),
					E('th', { 'class': 'th' }, _('Available')),
					E('th', { 'class': 'th' }, _('Use') + ' %'),
					E('th', { 'class': 'th' }, _('Mounted on')),
					E('th', { 'class': 'th cbi-section-actions' }, '')
				])
			]);
			var rows = [];
			if (storage.length) {
				storage[5] = E('div', { 'class': 'cbi-progressbar', 'title': storage[5], 'style': 'min-width:8em !important' }, E('div', { 'style': 'width:' + storage[5] }))
				//storage[5] = E('div', { 'class': 'cbi-progressbar', 'title': storage[3] + ' / ' + storage[2] + ' (' + storage[5] + ')', 'style': 'min-width:8em !important' }, [
				//	E('div', { 'style': 'width:' + storage[5] })
				//]);
				rows.push(storage);
			};

			cbi_update_table(table, rows, E('em', _('<span style=\'color:red;font-weight:bold\'>Device not exist or mount point in the wrong location<span/>')));
			return E('div', { 'class': 'cbi-section cbi-tblsection' }, [
					E('h3', _('Storage Device')), table ]);
		}, o, this);

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
		o.validate = function(section, value) {
			if (value == null || value == '')
				return _('Expecting: non-empty value');
			return true;
		};

		if (releaseslist.length) {
			for (var i = 0; i < releaseslist.length; i++)
				o.value(releaseslist[i]);
		};

		o = s.option(form.Button, '_getversion', _('Get Version'));
		o.modalonly = true;
		o.write = function() {};
		o.onclick = function() {
			window.setTimeout(function() {
				window.location = window.location.href.split('#')[0];
			}, L.env.apply_display * 3000);

			return fs.exec('/etc/init.d/packagesync', ['getver'])
				.catch(function(e) { ui.addNotification(null, E('p', e.message), 'error') });
		};

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
