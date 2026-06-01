# Banco Nexus — Backend API

API REST desarrollada con Node.js, Express y MongoDB Atlas para el sistema bancario Banco Nexus. Incluye autenticación JWT, transacciones atómicas, auditoría completa y despliegue con Docker Swarm en AWS.

---

## Tecnologías utilizadas

| Tecnología     | Uso                                   |
|----------------|---------------------------------------|
| Node.js 20     | Runtime                               |
| Express 4      | Framework HTTP                        |
| MongoDB Atlas  | Base de datos administrada en la nube |
| bcrypt         | Hash de contraseñas                   |
| jsonwebtoken   | Autenticación stateless con JWT       |
| dotenv         | Variables de entorno                  |
| Docker + Swarm | Contenedorización y orquestación      |
| GitHub Actions | CI/CD automatizado                    |

---

## Variables de entorno

Renombra `.env.example` a `.env` y rellena los valores:

```env
MONGODB_USER=tu_usuario_atlas
MONGODB_PASSWORD=tu_password_atlas
MONGODB_SERVER=cluster0.xxxxx.mongodb.net
JWT_SECRET=secreto_largo_y_aleatorio
PORT=3001
ALLOWED_ORIGIN=http://localhost:3000
```

---

## Instalación local

```bash
# Instalar dependencias
npm install

# Modo desarrollo (con nodemon)
npm run dev

# Modo producción
npm start
```

---

## Endpoints

### Autenticación — `/api/auth`

| POST | `/api/auth/register` | Registro de cliente + apertura de cuenta
| POST | `/api/auth/login`    | Login, retorna JWT                       

---

### Cuenta — `/api/cuenta`

| GET | `/api/cuenta/saldo`       | Saldo y datos de la cuenta 
| GET | `/api/cuenta/movimientos` | Historial paginado (`?page=1&limit=20`) 
| GET | `/api/cuenta/perfil`      | Datos del cliente y cuenta 
| PUT | `/api/cuenta/perfil`      | Actualizar nombre y/o teléfono 

---

### Transferencias — `/api/transferencia`

| POST | `/api/transferencia` | Transferencia entre cuentas (atómica)

---

### Beneficiarios — `/api/beneficiarios`

| GET    | `/api/beneficiarios`     | Listar beneficiarios del usuario
| POST   | `/api/beneficiarios`     | Agregar beneficiario 
| DELETE | `/api/beneficiarios/:id` | Eliminar beneficiario 

---

## Docker — Desarrollo local

```bash
# Desde la raíz del repositorio
docker compose up --build

# Detener
docker compose down
```

El backend queda disponible en `http://localhost:3001`.

---

## Docker Swarm — Producción en AWS

### 1. Construir y subir imágenes a Docker Hub

```bash
docker build -t tu-usuario/nexus-backend:latest ./backend
docker push tu-usuario/nexus-backend:latest
```

### 2. Configurar las instancias EC2

```bash
# En las instancias
sudo apt update && sudo apt install -y docker.io
sudo systemctl enable --now docker

# Solo en EC2 #1 (Swarm Manager)
docker swarm init --advertise-addr <IP-PRIVADA-EC2-1>

# En EC2 #2 y EC2 #3 (Workers) — usar el token del paso anterior
docker swarm join --token <TOKEN> <IP-EC2-1>:2377
```

### 3. Desplegar el stack

```bash
# Copiar archivos al manager
scp docker-stack.yml ubuntu@<IP-EC2-1>:~/
scp backend/.env ubuntu@<IP-EC2-1>:~/nexus.env

# Desde EC2 #1
docker stack deploy -c docker-stack.yml nexus

# Verificar réplicas
docker service ls
docker service ps nexus_backend
```

---

## CI/CD — GitHub Actions

Cada push a `main` dispara automáticamente:

1. Build de la imagen Docker del backend
2. Push a Docker Hub (etiquetado con `latest` y SHA del commit)
3. Deploy vía SSH al Swarm Manager en AWS

### Secrets requeridos en GitHub

Ir a **Settings → Secrets and variables → Actions**:

| `DOCKER_USERNAME` | Tu usuario de Docker Hub                   |
| `DOCKER_PASSWORD` | Tu contraseña o Access Token de Docker Hub |
| `EC2_HOST`        | IP pública del Swarm Manager (EC2 #1)      |
| `EC2_SSH_KEY`     | Contenido completo del archivo `.pem`      |

---
