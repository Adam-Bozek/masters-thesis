# * @ Author: Bc. Adam Božek
# * @ Create Time: 2025-10-24 18:43:48
# * @ Description: This repository contains a full-stack application suite developed within a master’s thesis.
#		 It is designed to support the screening of children using the Slovak
#		 implementation of the TEKOS II screening instrument, short version. Copyright (C) 2026  Bc. Adam Božek
# * @ License: This program is free software: you can redistribute it and/or modify it under the terms of
#		 the GNU Affero General Public License as published by the Free Software Foundation, either
#		 version 3 of the License, or any later version. This program is distributed in the hope
#		 that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty
#		 of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
#		 See the GNU Affero General Public License for more details.
#		 You should have received a copy of the GNU Affero General Public License along with this program.
#		 If not, see <https://www.gnu.org/licenses/>..

FROM python:3.14.3-alpine

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ /app/
COPY frontend/public/data /app/frontend/public/data

ENV FLASK_APP=run.py
ENV FLASK_ENV=production

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/api/health', timeout=2).read()"

CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "--timeout", "120", "run:app"]