# Banco Nexus - Backend API

API REST desarrollada con Node.js, Express y MongoDB para la  Banco Nexus.

---

# Tecnologías utilizadas

- Node.js
- Express
- MongoDB
- CORS
- Dotenv

---

# Instalación

## Instalar dependencias

```bash
npm install
```

---

## Ejecutar servidor

Modo desarrollo:

```bash
npm run dev
```

Modo normal:

```bash
npm start
```

---

# Endpoints

## Obtener cuenta

### GET

```http
/api/cuenta/:cuenta
```
---

## Obtener historial

### GET

```http
/api/historial/:cuenta
```

---

## Realizar depósito

### POST

```http
/api/deposito
```

---

## Realizar retiro

### POST

```http
/api/retiro
```

---