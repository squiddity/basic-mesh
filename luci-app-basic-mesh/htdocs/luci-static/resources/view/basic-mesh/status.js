'use strict';
'require view';
'require ui';
'require fs';

return view.extend({

	load: function() {
		return fs.exec('/usr/sbin/iw', ['dev']).then(function(res) {
			var stdout = (res && res.stdout) || '';
			var interfaces = [];
			var currentIface = null;

			stdout.split('\n').forEach(function(line) {
				var m = line.match(/^\s*Interface\s+(\S+)/);
				if (m)
					currentIface = m[1];
				if (/\s*type mesh point/.test(line) && currentIface) {
					interfaces.push(currentIface);
					currentIface = null;
				}
			});

			if (interfaces.length === 0)
				return { interfaces: [], results: [] };

			var promises = [];

			interfaces.forEach(function(iface) {
				promises.push(
					fs.exec('/usr/sbin/iw', ['dev', iface, 'mesh_param', 'dump'])
						.then(function(r) {
							return { iface: iface, type: 'mesh_param', data: (r && r.stdout) || '' };
						})
						.catch(function() {
							return { iface: iface, type: 'mesh_param', data: 'Error reading mesh params' };
						})
				);

				promises.push(
					fs.exec('/usr/sbin/iw', ['dev', iface, 'station', 'dump'])
						.then(function(r) {
							return { iface: iface, type: 'station_dump', data: (r && r.stdout) || '' };
						})
						.catch(function() {
							return { iface: iface, type: 'station_dump', data: 'Error reading station dump' };
						})
				);

				promises.push(
					fs.exec('/usr/sbin/iw', ['dev', iface, 'mpath', 'dump'])
						.then(function(r) {
							return { iface: iface, type: 'mpath_dump', data: (r && r.stdout) || '' };
						})
						.catch(function() {
							return { iface: iface, type: 'mpath_dump', data: 'Error reading mpath dump' };
						})
				);
			});

			return Promise.all(promises).then(function(results) {
				return { interfaces: interfaces, results: results };
			});
		}).catch(function() {
			return { interfaces: [], results: [], error: 'Failed to run iw — is the iw package installed?' };
		});
	},

	pollData: function() {
		return this.load();
	},

	render: function(data) {
		var view = E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('Mesh Status')),
			E('div', { 'class': 'cbi-map-descr' },
				_('Runtime mesh parameters and connected stations for each 802.11s mesh interface. ' +
				  'Data is read live from <code>iw</code> on each page load.'))
		]);

		if (data.error) {
			view.appendChild(E('div', { 'class': 'alert-message warning' }, data.error));
			return view;
		}

		if (data.interfaces.length === 0) {
			view.appendChild(
				E('div', { 'class': 'alert-message warning' },
					_('No active mesh point interfaces found. ' +
					  'Ensure a mesh interface is configured and up.'))
			);
			return view;
		}

		var resultsByIface = {};
		data.results.forEach(function(r) {
			if (!resultsByIface[r.iface])
				resultsByIface[r.iface] = {};
			resultsByIface[r.iface][r.type] = r.data;
		});

		data.interfaces.forEach(function(iface) {
			var info = resultsByIface[iface] || {};

			var section = E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Interface: %s').format(iface))
			]);

			// --- Mesh Parameters Table ---
			section.appendChild(E('h4', {}, _('Current Mesh Parameters')));

			var paramText = info.mesh_param || '';
			if (paramText && paramText.indexOf('Error') !== 0) {
				var table = E('table', { 'class': 'table' }, [
					E('tr', { 'class': 'tr table-titles' }, [
						E('th', { 'class': 'th' }, _('Parameter')),
						E('th', { 'class': 'th' }, _('Value'))
					])
				]);

				paramText.split('\n').forEach(function(line) {
					var m = line.match(/^\s*(\S+)\s*=\s*(.+)$/);
					if (!m) return;

					table.appendChild(E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, m[1]),
						E('td', { 'class': 'td' }, m[2].trim())
					]));
				});

				section.appendChild(table);
			} else {
				section.appendChild(E('div', { 'class': 'alert-message warning' },
					paramText || _('No mesh parameter data available.')));
			}

			// --- Station Dump ---
			section.appendChild(E('h4', {}, _('Connected Stations')));

			var stationText = info.station_dump || '';
			if (stationText.trim() === '' || stationText.indexOf('Error') === 0) {
				section.appendChild(E('div', { 'class': 'alert-message notice' },
					stationText || _('No stations connected.')));
			} else {
				// Parse station dump into per-station blocks
				var stations = [];
				var current = null;

				stationText.split('\n').forEach(function(line) {
					var m = line.match(/^Station\s+([0-9a-fA-F:]+)\s+\(on\s+(\S+)\)/);
					if (m) {
						current = { mac: m[1], fields: [] };
						stations.push(current);
					} else if (current && line.trim()) {
						var kv = line.match(/^\s+(.+?):\s+(.+)$/);
						if (kv)
							current.fields.push({ key: kv[1].trim(), value: kv[2].trim() });
					}
				});

				if (stations.length === 0) {
					section.appendChild(E('div', { 'class': 'alert-message notice' },
						_('No stations connected.')));
				} else {
					stations.forEach(function(sta) {
						var staSection = E('div', { 'style': 'margin-bottom: 1em;' }, [
							E('h5', {}, _('Station: %s').format(sta.mac))
						]);

						var table = E('table', { 'class': 'table' }, [
							E('tr', { 'class': 'tr table-titles' }, [
								E('th', { 'class': 'th' }, _('Field')),
								E('th', { 'class': 'th' }, _('Value'))
							])
						]);

						sta.fields.forEach(function(f) {
							table.appendChild(E('tr', { 'class': 'tr' }, [
								E('td', { 'class': 'td' }, f.key),
								E('td', { 'class': 'td' }, f.value)
							]));
						});

						staSection.appendChild(table);
						section.appendChild(staSection);
					});
				}
			}

			// --- Mesh Path Dump ---
			section.appendChild(E('h4', {}, _('Mesh Paths')));

			var mpathText = info.mpath_dump || '';
			if (mpathText.trim() === '' || mpathText.indexOf('Error') === 0) {
				section.appendChild(E('div', { 'class': 'alert-message notice' },
					mpathText || _('No mesh paths available.')));
			} else {
				var mpaths = [];
				var current = null;

				mpathText.split('\n').forEach(function(line) {
					var m = line.match(/^mpath\s+([0-9a-fA-F:]+)/);
					if (m) {
						current = { dest: m[1], fields: [] };
						mpaths.push(current);
					} else if (current) {
						var kv = line.match(/^\s+(\S+)\s*:\s*(.+)$/);
						if (kv)
							current.fields.push({ key: kv[1].trim(), value: kv[2].trim() });
					}
				});

				if (mpaths.length === 0) {
					section.appendChild(E('div', { 'class': 'alert-message notice' },
						_('No mesh paths available.')));
				} else {
					var mpathTable = E('table', { 'class': 'table' }, [
						E('tr', { 'class': 'tr table-titles' }, [
							E('th', { 'class': 'th' }, _('Destination')),
							E('th', { 'class': 'th' }, _('Next Hop')),
							E('th', { 'class': 'th' }, _('Hops')),
							E('th', { 'class': 'th' }, _('SNR'))
						])
					]);

					mpaths.forEach(function(mp) {
						var dest = '-', nextHop = '-', hops = '-', snr = '-';
						mp.fields.forEach(function(f) {
							if (f.key === 'next hop') nextHop = f.value;
							else if (f.key === 'hop count') hops = f.value;
							else if (f.key === 'snr') snr = f.value;
						});
						mp.fields.forEach(function(f) {
							if (f.key === 'dst') dest = f.value;
						});

						mpathTable.appendChild(E('tr', { 'class': 'tr' }, [
							E('td', { 'class': 'td' }, dest),
							E('td', { 'class': 'td' }, nextHop),
							E('td', { 'class': 'td' }, hops),
							E('td', { 'class': 'td' }, snr)
						]));
					});

					section.appendChild(mpathTable);
				}
			}

			view.appendChild(section);
		});

		// Refresh button
		var self = this;
		view.appendChild(E('div', { 'class': 'cbi-page-actions' }, [
			E('button', {
				'class': 'btn cbi-button-apply',
				'click': function() {
					var btn = this;
					btn.disabled = true;
					btn.textContent = _('Refreshing…');

					self.pollData().then(function(newData) {
						var container = view.parentNode;
						var newView = self.render(newData);
						container.replaceChild(newView, view);
					}).catch(function() {
						btn.disabled = false;
						btn.textContent = _('Refresh');
					});
				}
			}, _('Refresh'))
		]));

		return view;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null,
});
