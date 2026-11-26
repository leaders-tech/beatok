FROM node:22-alpine AS builder
WORKDIR /app
COPY build.mjs ./
COPY src ./src
RUN node build.mjs

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
