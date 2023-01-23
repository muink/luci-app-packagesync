'use strict';
'require view';
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
			_('packagesync used to build a local mirror feeds source on the router\n\
			To use packagesync, you need to prepare a storage device with a size of at least 16G and connect it to the router\n\
			and then open <a href="%s"><b>Mount Points</b></a>, find the connected device and set its mount point to %s, check Enabled and click Save&Apple')
			.format(L.url('admin', 'system', 'mounts'), mntpkgs));
		s.anonymous = true;

		return m.render();
	}
});
