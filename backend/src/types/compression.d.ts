declare module 'compression' {
  import { RequestHandler } from 'express';
  function compression(): RequestHandler;
  export default compression;
}
