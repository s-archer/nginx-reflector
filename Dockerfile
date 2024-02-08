# Use the official NGINX base image
FROM nginx

# Copy the NGINX configuration file with the custom capture-headers location
COPY nginx.conf /etc/nginx/nginx.conf
COPY http.js /etc/nginx/conf.d/http.js
COPY http.js /etc/nginx/http.js

# Create a directory for the site content
WORKDIR /usr/share/nginx/html

# Create an index.html file (optional)
COPY index.html /usr/share/nginx/html/index.html

# Create a startup script so that I can register the 
# NGINX container instance with NGINX One in XC...
# AND execute the 'start NGINX command' at the same time.
# This is because docker supports only a single CMD directive
# NGINX runs all scripts in the /docker-entrypoint.d/ directory
COPY startup.sh /docker-entrypoint.d/startup.sh 
RUN chmod +x /docker-entrypoint.d/startup.sh

# It seems that the NGINX Agent script needs sudo to run
RUN apt-get update && \
      apt-get -y install sudo

# Expose port 80
EXPOSE 8080

# Start NGINX
CMD ["nginx", "-g", "daemon off;"]