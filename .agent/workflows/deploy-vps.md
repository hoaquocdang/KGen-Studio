---
description: Deploy lên VPS (Docker + Traefik) tại kgen.cloud
---

# Deploy KGen lên VPS

Ứng dụng chạy trong Docker tại `/opt/kgen-gallery` trên VPS, qua Traefik reverse proxy.

## Bước 1: Commit và push code lên GitHub

```powershell
git add .
git commit -m "feat: mô tả thay đổi"
git push origin master
```

## Bước 2: SSH vào VPS và chạy deploy

```bash
cd /opt/kgen-gallery && git pull origin master && docker compose -f deploy/docker-compose.yml up -d --build --force-recreate
```

> **Lưu ý:** `--force-recreate` bắt buộc tạo lại container mới, tránh lỗi "container name already in use".
> Nếu VPS dùng `docker-compose` (chữ thường có dấu gạch ngang), dùng:
> ```bash
> cd /opt/kgen-gallery && git pull origin master && docker-compose -f deploy/docker-compose.yml up -d --build
> ```

## Bước 3: Kiểm tra container đang chạy

```bash
docker ps | grep kgen
docker logs kgen-gallery --tail 30
```

## Bước 4: Verify trên production

Mở `https://kgen.cloud` và `https://kgen.cloud/video` để kiểm tra.

---

## Lưu ý quan trọng

- File `site-config.js` (chứa API key) **không được commit lên Git** — VPS dùng volume mount từ file local trên server
- Nếu thay đổi `site-config.js`, phải edit trực tiếp trên VPS: `/opt/kgen-gallery/web-ui/site-config.js`
- Sau khi deploy video page, import n8n workflow: `web-ui/n8n-veo-video-workflow.json`
