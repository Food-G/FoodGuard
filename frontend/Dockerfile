FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
# localhost 는 ::1 로 풀리는데 nginx.conf 는 IPv4(listen 80)만 연다
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -q --spider http://127.0.0.1/ || exit 1
