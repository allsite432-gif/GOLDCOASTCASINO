class Router {
  constructor(){ this.routes = {}; }
  get(p,h){ this.routes['GET '+p]=h }
  post(p,h){ this.routes['POST '+p]=h }
}
function json(d){ return JSON.stringify(d) }
module.exports = { Router, json };
