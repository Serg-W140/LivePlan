export class Platform {
  static CHUNK_SIZE = 3800;

  static get isTelegram() {
    return Boolean(window.Telegram?.WebApp?.initData);
  }

  static get cloud() {
    return this.isTelegram ? window.Telegram.WebApp.CloudStorage : null;
  }

  static init() {
    if (!this.isTelegram) return;
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    if (tg.setHeaderColor) tg.setHeaderColor('#121212');
    if (tg.setBackgroundColor) tg.setBackgroundColor('#121212');
  }

  static saveCloud(key, valueStr) {
    if (!this.cloud) return;
    try {
      const totalChunks = Math.ceil(valueStr.length / this.CHUNK_SIZE) || 1;
      this.cloud.setItem(`${key}_meta`, String(totalChunks), () => {});
      for (let i = 0; i < totalChunks; i += 1) {
        const part = valueStr.slice(i * this.CHUNK_SIZE, (i + 1) * this.CHUNK_SIZE);
        this.cloud.setItem(`${key}_${i}`, part, () => {});
      }
    } catch (_) {}
  }

  static loadCloud(keys) {
    return new Promise((resolve) => {
      if (!this.cloud) {
        resolve(null);
        return;
      }
      const metaKeys = keys.map((k) => `${k}_meta`);
      try {
        this.cloud.getItems(metaKeys, (err, metaValues) => {
          if (err || !metaValues) {
            resolve(null);
            return;
          }
          const chunkKeys = [];
          const counts = {};
          keys.forEach((k) => {
            const cnt = parseInt(metaValues[`${k}_meta`], 10);
            if (cnt > 0) {
              counts[k] = cnt;
              for (let i = 0; i < cnt; i += 1) {
                chunkKeys.push(`${k}_${i}`);
              }
            }
          });

          if (chunkKeys.length === 0) {
            resolve({});
            return;
          }

          this.cloud.getItems(chunkKeys, (err2, chunks) => {
            if (err2 || !chunks) {
              resolve(null);
              return;
            }
            const result = {};
            Object.entries(counts).forEach(([k, cnt]) => {
              let fullStr = '';
              for (let i = 0; i < cnt; i += 1) {
                fullStr += chunks[`${k}_${i}`] || '';
              }
              if (fullStr) result[k] = fullStr;
            });
            resolve(result);
          });
        });
      } catch (_) {
        resolve(null);
      }
    });
  }
}
