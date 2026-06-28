# syntax=docker/dockerfile:1

FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .

RUN npx ng build --configuration production

FROM nginx:alpine AS runtime

COPY --from=build /app/dist/coreui-free-angular-admin-template/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 4215

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4215/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
