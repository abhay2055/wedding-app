-- Creates a separate database for the automated test suite so tests never
-- run against local development data.
CREATE DATABASE wedding_app_test OWNER wedding_app;
