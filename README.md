# PeerCharge

**A community-powered way to find EV charging when you need it.**

[Live Demo](https://peer-charge-hazel.vercel.app/) · [Demo
Video](https://drive.google.com/drive/folders/1gxeH3CML19HlrZg-wkMOtlME-dZbxoJT?usp=sharing)
· [GitHub Repository](https://github.com/Saksham243/PeerCharge)

## Why PeerCharge?

Electric vehicles are becoming a more common sight on Indian roads, but
charging access has not always kept pace. Public chargers can be
difficult to find in some areas, and that uncertainty becomes even more
frustrating when you're travelling between cities or taking a route
you're not familiar with.

That uncertainty is often called *range anxiety*: the worry that your
battery will run low before you can reach a reliable charging point.

PeerCharge explores a simple idea: **what if EV owners could make
suitable charging access available to other drivers, instead of relying
only on dedicated public charging stations?**

A person with a suitable parking space and charging setup could list it
as a host. An EV driver could explore available stations, request a
booking, and coordinate a charging session. Over time, a community of
hosts could help make charging options easier to discover, especially in
places where dedicated infrastructure is limited.

PeerCharge is a student project and prototype, not a replacement for
certified public charging infrastructure. The goal is to demonstrate how
sharing existing resources could help make EV journeys less stressful.

## How it works

PeerCharge has two sides: **travellers** who need a place to charge, and
**hosts** who make a charging location available.

### For travellers

-   **Explore charging options:** Browse stations listed on the
    platform.
-   **Plan with more confidence:** Find possible charging stops before
    or during a trip rather than depending on a single charging
    location.
-   **Request a booking:** Send a booking request for a station.
-   **Track the session:** Follow the booking flow and session status in
    the app.
-   **Manage a demo wallet:** Use the wallet interface to try the
    project's top-up and balance flow.

Imagine driving to another city and finding that the next public charger
is inconveniently far away. A community listing near your route could
give you another option to investigate and arrange in advance. That is
the experience PeerCharge is designed to explore.

### For hosts

You don't necessarily need to operate a large charging business to
participate in a community charging network. If you have a suitable
parking spot and a safe, compatible charging setup, you could
potentially make that location available to EV drivers.

In the PeerCharge prototype, the host side lets users list stations and
manage incoming booking requests. Hosts can accept or decline requests
and manage the charging session through the app.

The idea is to make participation approachable: people with useful
charging access may be able to share it, while travellers gain more
options. In a real-world deployment, hosts would need to confirm
electrical capacity, charger and vehicle compatibility, safe access,
local requirements, pricing, and any applicable permissions before
offering charging to others.

## What the project includes

-   User registration and login
-   Traveller and host workflows
-   Station discovery
-   Booking requests and booking status management
-   Host accept/decline controls
-   Charging-session start/stop flow
-   Booking history and host analytics
-   Demo wallet and simulated top-ups

This is a prototype. Wallet balances and top-ups are for demonstration
purposes; the application does not process real payments.

## Demo

-   **Live app:** https://peer-charge-hazel.vercel.app/
-   **Demo video:**
    https://drive.google.com/drive/folders/1gxeH3CML19HlrZg-wkMOtlME-dZbxoJT?usp=sharing

## Tech stack

-   **Frontend:** React, Vite, React Router, Axios
-   **Backend:** Node.js, Express
-   **Database:** MongoDB
-   **Authentication:** JSON Web Tokens (JWT)
-   **Frontend hosting:** Vercel
-   **Backend hosting:** Render

## Run it locally

You'll need Node.js, npm, and a MongoDB connection string.

### 1. Clone the repository

``` bash
git clone https://github.com/Saksham243/PeerCharge.git
cd PeerCharge
```

### 2. Set up the backend

``` bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory:

``` env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=replace_with_a_long_random_secret
```

Start the backend:

``` bash
npm start
```

The API will run on the configured port (5000 by default for local
development).

### 3. Set up the frontend

Open a second terminal:

``` bash
cd frontend
npm install
npm run dev
```

Vite will print the local frontend URL, usually `http://localhost:5173`.

The frontend API requests must point to the backend you are running. For
local development, use your local backend URL; for the deployed app, use
the Render backend URL. If you change the API base URL, check every API
call so none are still pointing to an old address.

## Deployment notes

-   The frontend is deployed from the `frontend` directory on Vercel.
-   The backend is deployed from the `backend` directory on Render.
-   Configure `MONGO_URI` and `JWT_SECRET` as Render environment
    variables. Keep secrets out of Git.
-   The backend's CORS allowlist must include the exact frontend origin
    you use.
-   MongoDB Atlas network access must permit connections from the
    deployed backend.
-   The project uses MongoDB transactions for parts of the booking flow,
    so use a MongoDB deployment that supports transactions (such as an
    Atlas replica set).

## A note on the idea

PeerCharge isn't claiming that community charging alone can solve
India's EV infrastructure gap. Dedicated public charging, reliable
electricity supply, safety standards, and wider infrastructure
investment still matter. The project looks at one complementary
possibility: making better use of suitable charging access that people
may already have.

If more hosts and travellers can connect through a simple platform, a
long journey may have one more practical charging option---and EV
ownership can feel a little less uncertain.

------------------------------------------------------------------------

Built as a student project to explore community-powered EV charging in
India.
