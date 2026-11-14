# 前端镜像：Vite 构建 + Nginx 托管（容器内 80，宿主机映射 8080）
FROM node:20-alpine AS build
WORKDIR /build
COPY package.json package-lock.json* ./
RUN npm install --registry=https://registry.npmmirror.com
COPY . .
RUN npm run build

FROM nginx:1.25-alpine
COPY --from=build /build/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
