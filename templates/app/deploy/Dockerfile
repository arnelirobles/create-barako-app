# The site, as one image.
#
# Built on the VM by `baryovm stack release`, not pushed to a registry, so there is no registry to
# log into and no image to keep private. The build context is the repository root.

FROM node:22-alpine AS build
WORKDIR /app

# Dependencies first, so editing a page does not reinstall node_modules.
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install --no-audit --no-fund; fi

COPY . .
# next.config.ts sets output: "standalone", which is what makes the runtime stage small: Next works
# out which files are actually reached and copies only those.
RUN mkdir -p public && npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# Without this the server binds loopback inside the container, where nothing outside it can reach.
ENV HOSTNAME=0.0.0.0

# Not root. The server reads the CMS and renders HTML; it has no reason to own its own files.
RUN addgroup -S nodejs && adduser -S next -G nodejs

COPY --from=build --chown=next:nodejs /app/.next/standalone ./
COPY --from=build --chown=next:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=next:nodejs /app/public ./public

USER next
EXPOSE 3000
CMD ["node", "server.js"]
