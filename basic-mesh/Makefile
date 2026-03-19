include $(TOPDIR)/rules.mk

PKG_NAME:=basic-mesh
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

PKG_MAINTAINER:=
PKG_LICENSE:=GPL-2.0-or-later

include $(INCLUDE_DIR)/package.mk

define Package/basic-mesh
  SECTION:=net
  CATEGORY:=Network
  TITLE:=802.11s mesh_param manager
  DEPENDS:=+iw
  PKGARCH:=all
endef

define Package/basic-mesh/description
  Manages 802.11s mesh_param settings via UCI and applies them using iw
  when a mesh interface comes up. Does not manage wireless or network config.
endef

define Build/Compile
endef

define Package/basic-mesh/install
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_DATA) ./files/etc/config/basic-mesh $(1)/etc/config/basic-mesh

	$(INSTALL_DIR) $(1)/etc/hotplug.d/iface
	$(INSTALL_BIN) ./files/etc/hotplug.d/iface/30-basic-mesh $(1)/etc/hotplug.d/iface/30-basic-mesh

	$(INSTALL_DIR) $(1)/etc/uci-defaults
	$(INSTALL_BIN) ./files/etc/uci-defaults/99-basic-mesh $(1)/etc/uci-defaults/99-basic-mesh

	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/etc/init.d/basic-mesh $(1)/etc/init.d/basic-mesh

	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) ./files/usr/bin/basic-mesh-apply $(1)/usr/bin/basic-mesh-apply

	$(INSTALL_DIR) $(1)/usr/share/ucitrack
	$(INSTALL_DATA) ./files/usr/share/ucitrack/basic-mesh.json $(1)/usr/share/ucitrack/basic-mesh.json
endef

$(eval $(call BuildPackage,basic-mesh))
