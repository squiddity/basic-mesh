include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-basic-mesh
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

PKG_MAINTAINER:=
PKG_LICENSE:=GPL-2.0-or-later

LUCI_TITLE:=LuCI support for basic-mesh
LUCI_DEPENDS:=+luci-base +basic-mesh
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
$(eval $(call BuildPackage,luci-app-basic-mesh))
