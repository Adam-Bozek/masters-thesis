# Overview

This subfolder `database/` contains four important files:

1. `.env` file  
2. `.gitignore` file  
3. `docker-compose.yml` file  
4. `init.sql` file  

## **`.env` File Description**
Since this code runs on the server, the `.env` file is **not included in this repository** for security reasons. However, it should follow this structure:

```shell
# Admin User (Full Access)
POSTGRES_USER="admin_user"
POSTGRES_PASSWORD="myp@ssw#rd!"
POSTGRES_DB="mydatabase"

# Read & Write User (Limited Access)
APP_USER="app_user"
APP_PASSWORD="readWr1t3#Secr3t!"
```

- **`POSTGRES_USER`** → Admin user of the database (has full privileges).
- **`APP_USER`** → The database user that will be used for API connections.  
- **Important:**  
  - **Never commit your `.env` file to Git!**  
  - Ensure that `.env` is added to `.gitignore` to prevent accidental leaks.  

---

## **`init.sql` File Description**
PostgreSQL **does not support `.env` variables inside SQL files**, so you must manually edit the `init.sql` file before running it.  

### **Required Manual Changes**
Before executing `init.sql`, replace the following placeholders with your actual values from the `.env` file:

| Placeholder                  | Replace With                      | Description |
|------------------------------|-----------------------------------|-------------|
| **`admin_user`**             | `POSTGRES_USER` from `.env`       | Admin database user |
| **`app_user`**               | `APP_USER` from `.env`            | API user with limited access |
| **`secret password`**        | `APP_PASSWORD` from `.env`        | Password for `app_user` |
| **`mydatabase`**             | `POSTGRES_DB` from `.env`         | Name of the database |

