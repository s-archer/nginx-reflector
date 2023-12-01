# Use the official NGINX base image
FROM nginx

# Copy the NGINX configuration file with the custom capture-headers location
COPY nginx.conf /etc/nginx/nginx.conf

# Create a directory for the site content
WORKDIR /usr/share/nginx/html

# Create an index.html file (optional)
RUN echo "Hello, NGINX!" > index.html

# Expose port 80
EXPOSE 8080

# Start NGINX
CMD ["nginx", "-g", "daemon off;"]
