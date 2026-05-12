// pages/user_custom1/user_custom1.js
const app = getApp();
const SELECT_OPTIONS = [
  {
    id: 1,
    text: "快来记录下📸你眼前的风景呀！"
  },
  {
    id: 2,
    text: "或是湖边，那条条垂柳🌿诉说眼前季节？"
  },
  {
    id: 3,
    text: "快看！湖面上有鸭子🦆"
  },
  {
    id: 4,
    text: "😉你想记录怎样的故事？"
  },
  {
    id: 5,
    text: "还是乡野点点烟火，最抚凡人心😊"
  }];
Page({
  //"../../images/left.gif"
  data: {
    scene_url: "",
    imgloading: false,
    Selectedtextid: SELECT_OPTIONS[0].id
  },


  onshow(options) {
     this.setData({
        imgloading: false,
        scene_url: "",
     });
  },

  gotowrite() {
    const url = this.data.scene_url;
    app.globalData.task_data.spot_url = url;
    if(url){
    wx.navigateTo({
      url:"../user_custom2/user_custom2",
    })}else{
      wx.showToast({
        title: "请先拍照哟😘",
        icon: "none",
        duration: 800
      });
    }
}
})