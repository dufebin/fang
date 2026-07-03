// 封面页（停车管理平台）行为配置
// 改这里即可切换，无需改逻辑代码
//
// 默认显示房产系统；只有 parkingOpenids 中的用户看到停车管理平台。
module.exports = {
  // 封面页路径（停车管理平台）
  coverPath: '/pages/parking/index',
  // 真实首页路径（房产系统）
  homePath: '/pages/index/index',
  // 回到前台时是否自动跳回封面页（隐私保护，仅对停车用户生效）
  redirectOnResume: true,
  // 停车管理平台白名单：只有这些 openid 的用户进入停车界面，其它用户默认房产系统
  parkingOpenids: [
    'olncgxgP6zw17jf9Rtzq72_s4DY',
    'olncgxkj9LsxCWZxPV8KAEq-6aFw',
  ],
  // 判断 openid 是否应进入停车管理平台
  shouldShowParking(openid) {
    return !!openid && this.parkingOpenids.indexOf(openid) >= 0
  },
}
