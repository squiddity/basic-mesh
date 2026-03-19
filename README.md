# basic-mesh

OpenWrt packages for managing [IEEE 802.11s](https://en.wikipedia.org/wiki/IEEE_802.11s) mesh network parameters. This repo provides two packages:

- **basic-mesh** — core UCI-based manager that applies `mesh_param` settings to mesh interfaces via `iw`
- **luci-app-basic-mesh** — LuCI web UI for configuring and monitoring mesh parameters

These packages manage **only** 802.11s `mesh_param` kernel settings. They do not create mesh interfaces, configure wireless settings (SSID, channel, power), manage IP addressing, or set up bridges. Those must be configured separately through OpenWrt's wireless and network configuration.

---

## Requirements

- OpenWrt 25.x
- A mesh point interface already configured (e.g. via `/etc/config/wireless`)
- `iw` (pulled in automatically as a dependency of `basic-mesh`)
- LuCI (required only for `luci-app-basic-mesh`)

---

## Installation

### Download packages

Download the `.apk` files for your OpenWrt version from the [Releases](../../releases) page. Two files are needed if you want the web UI:

```
basic-mesh-<version>-openwrt<version>.apk
luci-app-basic-mesh-<version>-openwrt<version>.apk   # optional, for LuCI UI
```

### Install via LuCI

1. In LuCI, go to **System → Software**
2. Click **Upload Package...**
3. Upload `basic-mesh-*.apk` first, then `luci-app-basic-mesh-*.apk`
4. Confirm installation for each

### Install via CLI

Transfer the `.apk` files to your router (e.g. via `scp`), then:

```sh
# Install core package
apk add --allow-untrusted basic-mesh-*.apk

# Install LuCI app (optional)
apk add --allow-untrusted luci-app-basic-mesh-*.apk
```

---

## Configuration

Settings are stored in `/etc/config/basic-mesh` using UCI. Each section corresponds to one mesh interface by name (e.g. `mesh0`, `wlan0-mesh`).

### Using the LuCI web UI

After installing `luci-app-basic-mesh`, navigate to **Network → Mesh Params** in LuCI.

**To add a new interface:**
1. Click **Add mesh interface** and enter the interface name (must match the actual interface, e.g. `mesh0`)
2. Select a **Parameter Template** to populate sensible defaults for the node's role:
   - **Gateway / Portal** — node has an internet or LAN uplink; acts as mesh root and gate
   - **Peer** — mesh-only node with no uplink; relies on HWMP to discover the gateway
   - **Peer Relay** — like Peer, but statically advertises gate reachability to downstream nodes; use this for relay nodes with a known stable path to the gateway
   - **Manual** — leave all fields as-is and set values individually
3. Adjust any individual parameters as needed
4. Click **Save & Apply**

Parameters are applied automatically the next time the interface comes up. To apply immediately without bouncing the interface, use the CLI (see below).

**To monitor mesh status:**
Navigate to **Network → Mesh Params → Status** to view current parameter values and connected mesh peer stations for each active mesh interface.

### Using UCI directly

```sh
# Create a new section for interface mesh0
uci set basic-mesh.mesh0=mesh_params

# Set individual parameters
uci set basic-mesh.mesh0.mesh_fwding=1
uci set basic-mesh.mesh0.mesh_hwmp_rootmode=4
uci set basic-mesh.mesh0.mesh_gate_announcements=1
uci set basic-mesh.mesh0.mesh_connected_to_gate=1
uci set basic-mesh.mesh0.mesh_max_peer_links=32
uci set basic-mesh.mesh0.mesh_ttl=31
uci set basic-mesh.mesh0.mesh_element_ttl=31
uci set basic-mesh.mesh0.mesh_nolearn=0

uci commit basic-mesh
```

Only options explicitly set in UCI are applied — unset options use kernel defaults.

---

## Applying parameters

### Automatic (hotplug)

Parameters are applied automatically when the interface comes up, via a hotplug handler at `/etc/hotplug.d/iface/30-basic-mesh`. No manual action is required after a reboot or interface restart.

### Manual (CLI)

To apply parameters to a running interface without restarting it:

```sh
basic-mesh-apply mesh0
```

This reads the UCI config for `mesh0` and calls `iw dev mesh0 set mesh_param <param> <value>` for each configured option. Exit code is non-zero if any parameter failed to apply.

### Verify applied parameters

```sh
# Show all current mesh_param values on an interface
iw dev mesh0 get mesh_param

# Show connected mesh peer stations
iw dev mesh0 station dump
```

---

## Parameter reference

The full set of supported parameters with descriptions is visible in the LuCI UI. Key parameters by category:

| Category | Parameter | Notes |
|---|---|---|
| Forwarding | `mesh_fwding` | Must be `1` for traffic to transit between nodes |
| Forwarding | `mesh_nolearn` | Set `0`; `1` disables path learning and breaks unicast |
| HWMP routing | `mesh_hwmp_rootmode` | `4` (RANN+PREP) on gateway, `0` on peers |
| Gate | `mesh_gate_announcements` | `1` on gateway so peers can discover it |
| Gate | `mesh_connected_to_gate` | `1` on gateway and peer-relay nodes |
| Peer links | `mesh_max_peer_links` | `32` for gateway, `6` for typical peer |
| TTL | `mesh_ttl` | Default `31`; do not set to `0` |
| TTL | `mesh_element_ttl` | Default `31`; do not set to `0` |

---

## Template quick reference

| Parameter | Gateway | Peer Relay | Peer |
|---|---|---|---|
| `mesh_hwmp_rootmode` | `4` | `0` | `0` |
| `mesh_gate_announcements` | `1` | `0` | `0` |
| `mesh_connected_to_gate` | `1` | `1` | `0` |
| `mesh_max_peer_links` | `32` | `6` | `6` |
| `mesh_fwding` | `1` | `1` | `1` |
| `mesh_nolearn` | `0` | `0` | `0` |
| `mesh_ttl` | `31` | `31` | `31` |

---

## License

GPL-2.0-or-later
