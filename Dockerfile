# Use the official NGINX base image
FROM nginx

# Copy the NGINX configuration file with the custom capture-headers location
COPY nginx.conf /etc/nginx/nginx.conf

# Create a directory for the site content
WORKDIR /usr/share/nginx/html

# Create an index.html file (optional)
RUN echo "Hello, NGINX!" > index.html

# Create an directory because write permission not allowed on RE
RUN mkdir /var/cache/nginx/client_temp

# Expose port 80
EXPOSE 80

# Start NGINX
CMD ["nginx", "-g", "daemon off;"]
