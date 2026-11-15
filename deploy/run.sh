#!/bin/sh
# The function's handler (T-013). The Lambda Web Adapter layer (AWS_LAMBDA_EXEC_WRAPPER=/opt/bootstrap)
# runs this, then forwards each Function URL request to the Next.js server on port 8080.
# HOSTNAME is set here because Lambda sets its own value, and Next.js listens on HOSTNAME.
export HOSTNAME=127.0.0.1
export PORT=8080
exec node server.js
