'use strict';
'require view';
'require form';
'require uci';
'require ui';

/*
 * LuCI view for basic-mesh: manages 802.11s mesh_param settings per interface.
 *
 * Each UCI section in /etc/config/basic-mesh corresponds to one mesh interface.
 * The section name is the interface name (e.g. mesh0, wlan0-mesh).
 * Only options that are explicitly set are applied by basic-mesh-apply.
 *
 * A "template" option stores the last-applied preset name (gateway/peer) for
 * display purposes; it is not a mesh_param and is ignored by basic-mesh-apply.
 */

var MESH_PARAMS = [
	{ name: 'mesh_retry_timeout',                    title: 'Retry Timeout',                       description: 'Retry timeout in ms before attempting to establish a new peer link.' },
	{ name: 'mesh_confirm_timeout',                  title: 'Confirm Timeout',                     description: 'Confirm timeout in ms before cancelling a peer link open request.' },
	{ name: 'mesh_holding_timeout',                  title: 'Holding Timeout',                     description: 'Holding timeout in ms before allowing a peer link re-establishment.' },
	{ name: 'mesh_max_peer_links',                   title: 'Max Peer Links',                      description: 'Maximum number of peer links (0–255).' },
	{ name: 'mesh_max_retries',                      title: 'Max Retries',                         description: 'Maximum number of peer link open retries (0–16).' },
	{ name: 'mesh_ttl',                              title: 'TTL',                                 description: 'Default mesh TTL value for transmitted mesh frames.' },
	{ name: 'mesh_element_ttl',                      title: 'Element TTL',                         description: 'Default mesh TTL for path selection elements.' },
	{ name: 'mesh_auto_open_plinks',                 title: 'Auto Open Peer Links',                description: '1 = automatically open peer links; 0 = manual only.' },
	{ name: 'mesh_hwmp_max_preq_retries',            title: 'HWMP Max PREQ Retries',               description: 'Number of HWMP PREQ retries for a path before notifying the originator.' },
	{ name: 'mesh_path_refresh_time',                title: 'Path Refresh Time',                   description: 'Interval in ms at which the mesh path is refreshed.' },
	{ name: 'mesh_min_discovery_timeout',            title: 'Min Discovery Timeout',               description: 'Minimum discovery timeout in ms for path selection.' },
	{ name: 'mesh_hwmp_active_path_timeout',         title: 'HWMP Active Path Timeout',            description: 'HWMP active path state timeout in ms.' },
	{ name: 'mesh_hwmp_preq_min_interval',           title: 'HWMP PREQ Min Interval',              description: 'Minimum interval in ms between PREQ frames to the same destination.' },
	{ name: 'mesh_hwmp_net_diameter_traversal_time', title: 'HWMP Net Diameter Traversal Time',    description: 'Estimated time in ms to traverse the mesh network diameter.' },
	{ name: 'mesh_hwmp_rootmode',                    title: 'HWMP Root Mode',                      description: '0=disabled, 1=RANN, 2=PROACTIVE PREQ (no reply), 3=PROACTIVE PREQ+PREP, 4=RANN+PREP.' },
	{ name: 'mesh_hwmp_rann_interval',               title: 'HWMP RANN Interval',                  description: 'Interval in ms between RANN frames.' },
	{ name: 'mesh_gate_announcements',               title: 'Gate Announcements',                  description: '1 = node is a mesh gate and sends announcements.' },
	{ name: 'mesh_fwding',                           title: 'Forwarding',                          description: '1 = mesh forwarding enabled; 0 = disabled.' },
	{ name: 'mesh_sync_offset_max_neighs',           title: 'Sync Offset Max Neighbours',          description: 'Max neighbours for clock synchronisation.' },
	{ name: 'mesh_rssi_threshold',                   title: 'RSSI Threshold',                      description: 'RSSI threshold (dBm, signed) below which peer links are not established.' },
	{ name: 'mesh_hwmp_active_path_to_root_timeout', title: 'HWMP Active Path-to-Root Timeout',    description: 'Active path-to-root state timeout in ms.' },
	{ name: 'mesh_hwmp_root_interval',               title: 'HWMP Root Interval',                  description: 'Interval in ms between PREQ frames sent by a root node.' },
	{ name: 'mesh_hwmp_confirmation_interval',       title: 'HWMP Confirmation Interval',          description: 'Minimum interval in ms between PREQ frames sent by a root node for path confirmation.' },
	{ name: 'mesh_power_mode',                       title: 'Power Mode',                          description: '0=active, 1=light sleep, 2=deep sleep.' },
	{ name: 'mesh_awake_window',                     title: 'Awake Window',                        description: 'Awake window duration in ms when in power-save mode.' },
	{ name: 'mesh_plink_timeout',                    title: 'Peer Link Timeout',                   description: 'Inactivity timeout in seconds before a peer link is torn down (0 = disabled).' },
	{ name: 'mesh_connected_to_gate',                title: 'Connected to Gate',                   description: '1 = this node is connected to a mesh gate.' },
	{ name: 'mesh_nolearn',                          title: 'No Learn',                            description: '1 = disable path learning (only use HWMP path discovery).' },
	{ name: 'mesh_connected_to_as',                  title: 'Connected to AS',                     description: '1 = this node is connected to an authentication server.' },
];

/*
 * Common baseline shared by all templates.
 * Individual templates override only the values that differ by role.
 */
var TEMPLATE_BASE = {
	mesh_retry_timeout:                    100,
	mesh_confirm_timeout:                  100,
	mesh_holding_timeout:                  100,
	mesh_max_retries:                      3,
	mesh_ttl:                              31,
	mesh_element_ttl:                      31,
	mesh_auto_open_plinks:                 1,
	mesh_hwmp_max_preq_retries:            4,
	mesh_path_refresh_time:                1000,
	mesh_min_discovery_timeout:            100,
	mesh_hwmp_active_path_timeout:         5000,
	mesh_hwmp_preq_min_interval:           10,
	mesh_hwmp_net_diameter_traversal_time: 50,
	mesh_hwmp_rann_interval:               5000,
	mesh_fwding:                           1,
	mesh_sync_offset_max_neighs:           50,
	mesh_rssi_threshold:                   -80,
	mesh_hwmp_active_path_to_root_timeout: 6000,
	mesh_hwmp_root_interval:               5000,
	mesh_hwmp_confirmation_interval:       2000,
	mesh_power_mode:                       0,
	mesh_awake_window:                     10,
	mesh_plink_timeout:                    0,
	mesh_nolearn:                          0,
	mesh_connected_to_as:                  0,
};

/*
 * Template definitions.
 * Each entry overrides the role-specific params on top of TEMPLATE_BASE.
 *
 * gateway: has an internet or LAN uplink; acts as mesh root and gate.
 *   - mesh_hwmp_rootmode 4  (RANN + PREP: proactively advertise root path and reply)
 *   - mesh_gate_announcements 1  (announce self as a mesh gate)
 *   - mesh_connected_to_gate 1  (this node IS a gate)
 *   - mesh_max_peer_links 32  (gateway can handle many peers)
 *
 * peer: no uplink; participates in mesh, may host an AP on another interface.
 *   - mesh_hwmp_rootmode 0  (not a root)
 *   - mesh_gate_announcements 0  (not a gate)
 *   - mesh_connected_to_gate 0  (will discover a gate via HWMP)
 *   - mesh_max_peer_links 6  (typical leaf/relay peer count)
 */
var TEMPLATES = {
	gateway: Object.assign({}, TEMPLATE_BASE, {
		mesh_max_peer_links:    32,
		mesh_hwmp_rootmode:     4,
		mesh_gate_announcements: 1,
		mesh_connected_to_gate:  1,
	}),
	peer: Object.assign({}, TEMPLATE_BASE, {
		mesh_max_peer_links:    6,
		mesh_hwmp_rootmode:     0,
		mesh_gate_announcements: 0,
		mesh_connected_to_gate:  0,
	}),
};

return view.extend({

	render: function() {
		var m = new form.Map('basic-mesh',
			_('Mesh Parameters'),
			_('Configure 802.11s mesh_param settings per mesh interface. ' +
			  'Settings are applied via <code>iw dev &lt;iface&gt; set mesh_param</code> ' +
			  'when the interface comes up. Only explicitly set values are applied; ' +
			  'leave fields blank to use kernel defaults. ' +
			  'This does not manage wireless or network configuration.')
		);

		var s = m.section(form.TypedSection, 'mesh_params', _('Mesh Interfaces'));
		s.anonymous = false;
		s.addremove = true;
		s.addbtntitle = _('Add mesh interface');

		s.sectiontitle = function(section_id) {
			return section_id;
		};

		// Validate that section names look like interface names
		s.validate = function(section_id) {
			if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(section_id)) {
				return _('Interface name must start with a letter or digit and contain only letters, digits, dots, hyphens, and underscores.');
			}
			return true;
		};

		// --- Template dropdown ---
		// Stored in UCI as 'template' option; ignored by basic-mesh-apply since
		// it is not in the hardcoded PARAMS list in that script.
		var paramOpts = {};

		var o_tmpl = s.option(form.ListValue, 'template',
			_('Parameter Template'),
			_('Select a preset to populate the fields below with sensible defaults for ' +
			  'the chosen node role. You can then adjust any individual value before saving. ' +
			  'Selecting <em>Manual</em> leaves all current values unchanged.')
		);
		o_tmpl.value('',        _('Manual'));
		o_tmpl.value('gateway', _('Gateway / Portal \u2014 has internet or LAN uplink'));
		o_tmpl.value('peer',    _('Peer \u2014 mesh only, no uplink (may host AP on another interface)'));
		o_tmpl.optional = true;
		o_tmpl.onchange = function(ev, section_id, value) {
			var tmpl = TEMPLATES[value];
			if (!tmpl) return;
			MESH_PARAMS.forEach(function(p) {
				var uiEl = paramOpts[p.name] && paramOpts[p.name].getUIElement(section_id);
				if (uiEl) uiEl.setValue(String(tmpl[p.name]));
			});
		};

		// --- Individual mesh_param fields ---
		for (var i = 0; i < MESH_PARAMS.length; i++) {
			var p = MESH_PARAMS[i];
			var o = s.option(form.Value, p.name, _(p.title), _(p.description));
			o.optional = true;
			o.placeholder = _('(kernel default)');
			o.validate = function(section_id, value) {
				if (value === '' || value === null)
					return true;
				if (!/^-?\d+$/.test(value))
					return _('Must be an integer value');
				return true;
			};
			paramOpts[p.name] = o;
		}

		return m.render();
	},

});
