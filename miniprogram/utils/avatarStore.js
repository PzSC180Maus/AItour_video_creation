const profileStore = require("./profileStore.js");

function isRemoteUrl(url) {
  return /^https?:\/\//.test(url) && !url.startsWith("http://tmp/");
}

function getAvatarExtension(path) {
  const match = String(path || "").match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/);
  return match ? match[1].toLowerCase() : "jpg";
}

function getTempFileURL(fileID) {
  if (!fileID) {
    return Promise.resolve("");
  }

  return wx.cloud
    .getTempFileURL({
      fileList: [fileID]
    })
    .then((urlRes) => {
      const item = urlRes.fileList && urlRes.fileList[0];
      const tempFileURL = item && item.tempFileURL;

      if (!tempFileURL) {
        throw new Error("missing avatar temp file url");
      }

      return tempFileURL;
    });
}

function normalizeAvatar(avatarUrl, avatarFileID) {
  if (avatarFileID) {
    return getTempFileURL(avatarFileID).then((nextAvatarUrl) => ({
      avatarUrl: nextAvatarUrl,
      avatarFileID
    }));
  }

  if (!avatarUrl) {
    return Promise.resolve({
      avatarUrl: "",
      avatarFileID: ""
    });
  }

  if (isRemoteUrl(avatarUrl)) {
    return Promise.resolve({
      avatarUrl,
      avatarFileID: ""
    });
  }

  return wx.cloud
    .uploadFile({
      cloudPath:
        "community-avatar-" +
        Date.now() +
        "-" +
        Math.random().toString(36).slice(2, 8) +
        "." +
        getAvatarExtension(avatarUrl),
      filePath: avatarUrl
    })
    .then((uploadRes) => {
      const fileID = uploadRes.fileID;

      if (!fileID) {
        throw new Error("missing avatar file id");
      }

      return getTempFileURL(fileID).then((nextAvatarUrl) => ({
        avatarUrl: nextAvatarUrl,
        avatarFileID: fileID
      }));
    });
}

function saveUserInfo(openid, userInfo) {
  const safeUserInfo = userInfo || {};

  return normalizeAvatar(
    safeUserInfo.avatarUrl || "",
    safeUserInfo.avatarFileID || ""
  ).then((avatar) => {
    const nextUserInfo = {
      nickName: safeUserInfo.nickName || "用户",
      avatarUrl: avatar.avatarUrl,
      avatarFileID: avatar.avatarFileID
    };

    return profileStore
      .saveUserInfo(openid, nextUserInfo)
      .then(() => nextUserInfo);
  });
}

module.exports = {
  getTempFileURL,
  normalizeAvatar,
  saveUserInfo
};
