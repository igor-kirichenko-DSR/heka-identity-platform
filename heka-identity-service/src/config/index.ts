import agent from './agent'
import express from './express'
import fileStorage from './file-storage'
import health from './health'
import mikroOrm from './mikro-orm'
import oidc from './oidc'
import pino from './pino'

export default [agent, express, health, oidc, mikroOrm, pino, fileStorage]
