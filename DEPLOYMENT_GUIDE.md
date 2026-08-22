# Production Deployment Guide: Temar Lije

Since you have the **GitHub Student Developer Pack**, you have access to free cloud hosting credits that are perfect for deploying containerized applications. 

The two best options in your pack for a Docker Compose project are:
1. **DigitalOcean** (Recommended): You get **$200 in free credits**. You can spin up a virtual machine with Docker pre-installed and run your system with a single command.
2. **Microsoft Azure**: You get **$100 in free credits** (no credit card required) to run a Linux virtual machine.

This guide outlines how to deploy using **DigitalOcean** and configure your Docker setup for public production access.

---

## 🎛️ Step 1: Adjust Your Ports for Production

In your local environment, you run the frontend on port `5173`. For production, you want visitors to access your website by typing just the IP address or domain name (which defaults to port `80`).

We can adjust the port mapping in `docker-compose.yml`.

### Action: Update Frontend Ports
Change the host port mapping under the `frontend` service from `"5173:80"` to `"80:80"` (and optionally port `"443:443"` if you configure SSL/HTTPS later).

```yaml
  frontend:
    # ... other configuration ...
    ports:
      - "80:80"  # Map public HTTP traffic directly to Nginx inside the container
```

---

## 🚀 Step 2: Deploying to a DigitalOcean Droplet (Recommended)

### 1. Redeem Your Credits
1. Go to the [GitHub Student Developer Pack](https://education.github.com/pack).
2. Locate **DigitalOcean** and click the link to claim your **$200 credit** promo code.
3. Sign up on DigitalOcean using that promo code.

### 2. Create a Docker Droplet (Virtual Machine)
DigitalOcean has a pre-configured template that comes with Docker and Docker Compose installed:
1. Click **Create** (top right) ➔ **Droplets**.
2. Under **Choose an image**, select the **Marketplace** tab.
3. Search for and select **Docker** (runs on Ubuntu).
4. Choose the CPU plan (the basic $6/month or $12/month plan is plenty for this project and will be covered entirely by your free credits).
5. Choose a datacenter region close to your users.
6. Under **Authentication**, select **SSH Key** (highly recommended for security) or **Password**.
7. Click **Create Droplet**.

---

## 🌐 Step 3: Getting Code onto Your Server & Running It

Once your Droplet is running, note its **Public IP Address** (e.g., `203.0.113.1`).

### 1. SSH Into Your Server
Open your terminal (PowerShell, Git Bash, or macOS Terminal) and run:
```bash
ssh root@your_droplet_ip
```
*(Enter the password or use your SSH key).*

### 2. Clone Your GitHub Repository
On the server, run:
```bash
git clone https://github.com/Gfani/Temar_lije.git
cd Temar_lije
```

### 3. Setup Your Environment Variables (`.env`)
Create a production `.env` file in the `Backend` directory:
```bash
nano Backend/.env
```
Add your production secrets (make sure to use secure keys):
```env
PORT=3000
NODE_ENV=production
JWT_ACCESS_SECRET=choose_a_long_random_string_here
JWT_REFRESH_SECRET=choose_another_long_random_string_here

# PostgreSQL Credentials (must match your docker-compose.yml)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_db_password
POSTGRES_DB=temar_lije
```
Save and exit (`Ctrl + O`, `Enter`, `Ctrl + X`).

### 4. Start Your Application
Launch the multi-container environment in detached mode:
```bash
docker compose up -d --build
```

Docker will pull your backend image from your Docker Hub repository (or build it locally on the server), boot up PostgreSQL, seed the database structure, and start serving the frontend.

---

## 🧪 Step 4: Verification

Open your browser and navigate to:
```
http://your_droplet_ip
```
You will see the Temar Lije frontend landing page live on the internet!

---

## 🎫 Bonus: Get a Free Custom Domain Name
Your GitHub Student Developer Pack also includes:
- **Namecheap**: 1 free `.me` domain name for 1 year.
- **Name.com**: 1 free domain name.

Once you claim your domain, go to your domain provider's DNS settings and create an **A Record**:
- **Host**: `@`
- **Value**: `your_droplet_ip`

After a few minutes, users can type `yourdomain.me` to access the application!
