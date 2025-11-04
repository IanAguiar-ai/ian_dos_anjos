// Rescrevendo a equação de bellman para rede mesh

class PointMesh{
    #alpha;
    #meters_decay;
    #gain;
    #max_to_connect;

    constructor(is_gtw, position){
        this.type = is_gtw === true ? "gtw" : "node"; //string
        this.position = position; //Array de dois elementos
        this.id = `${Math.floor(Math.random() * 1_000_000_000)}`; //string
        this.cost = is_gtw ? 0 : 100; //Int
        this.neighbors = {}; // Dicionario
        this.real_neighbors = {};
        this.best_neighbors = null; // Melhor vizinho

        this.#alpha = 0.95; // Cria dinamica, suavização exponencial
        this.#meters_decay = 60;// Float, quanto maior mais longe as conexões
        this.#gain = 1; // Float, ganho por conexão
        this.#max_to_connect = 150; // Distancia máxima para conexão;
    }

    #distance(point){ // Retorna float
        let soma = 0;
        for(let i = 0; i < this.position.length; i++){
            soma += (this.position[i] - point.position[i])*(this.position[i] - point.position[i]);
        }
        return Math.sqrt(soma);
    }

    #cost(point){ // Retorna float
        return this.#alpha*this.cost + (1-this.#alpha)*((point.cost+1) + (this.#distance(point) * 1/this.#meters_decay)**2 - this.#gain);
    }

    #find_neighbors(other_points){ // Retorna nada
        for(const point of other_points){
            if(point.id == this.id){
                continue;
            }

            const cost_to_point = this.#cost(point); //Float

            if((cost_to_point <= this.#max_to_connect) && (this.#distance(point) <= this.#max_to_connect)){
                this.neighbors[point.id] = cost_to_point; // Salva o custo daquele vizinho caso ele seja valido
                this.real_neighbors[point.id] = point;
            }
        }
    }

    #update_cost(){ // Retorna nada
        const list_costs = [this.cost, ...Object.values(this.neighbors).map(n => n.cost)];// Lista de custos
        const inf_limit = this.type === "gtw" ? 0 : 1;// Limite inferior
        this.cost = Math.max(Math.min(...list_costs), inf_limit);

        if(Object.keys(this.neighbors).length > 0){ // Só processa se tiver vizinhos
            const all_neighbors = Object.entries(this.neighbors).sort((cost_1, cost_2) => cost_1[1] - cost_2[1])
            
            const best_id = all_neighbors[0][0];
            this.cost = all_neighbors[0][1];
            this.best_neighbors = this.real_neighbors[best_id]; //Melhor vizinho

            if (all_neighbors[0][1] > this.cost) {
                this.cost = (1 - this.#alpha)*100 + this.#alpha*this.cost; // Se perder o contato com o gtw
            }
        }
    }

    #clean_neighbors(){ // Retorna nada
        this.neighbors = {};
        this.best_neighbors = null;
    }

    run(other_points){
        if(this.type === "gtw"){
            return false;
        }
        this.#clean_neighbors();
        this.#find_neighbors(other_points)
        this.#update_cost();
    }

}

/*
const all_points = []; // Lista de pontos
for(let index = 0; index < 100; index++){
    const is_gtw = index === 0 ? true : false;
    console.log(is_gtw);
    all_points.push(new PointMesh(is_gtw, [Math.random()*1_000, Math.random()*1_000]))
}

for(const point of all_points){
        console.log(point);
    }

for(let iteration = 0; iteration < 1000; iteration++){
    for(const point of all_points){
        point.run(all_points);
    }
}

for(const point of all_points){
    console.log(point);
}
*/

const canvas = document.getElementById("mesh")
const ctx = canvas.getContext("2d");

function ajustarCanvas(){
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
ajustarCanvas();
window.addEventListener("resize", ajustarCanvas);

const all_points = []; // Lista de pontos
for(let index = 0; index < canvas.width/70*canvas.height/70; index++){
    const is_gtw = index === 0 ? true : false;
    console.log(is_gtw);
    all_points.push(new PointMesh(is_gtw, [Math.random()*canvas.width, Math.random()*canvas.height]))
}

// mapeia custo -> cor (quanto menor o custo, mais escura a linha)
function colorFromCost(cost, maxCost){
  const t = Math.max(0, Math.min(1, cost / (maxCost || 1))); // [0..1]
  const g = Math.round(220 * t); // 0 = preto, 220 = claro
  return `rgb(${g},${g},${g})`;
}

// desenha ponto preenchido
function desenharPonto(x, y, cor = "red", raio = 5) {
  const canvasEl = document.getElementById("mesh");
  if (!canvasEl) return;
  const ctx = canvasEl.getContext("2d");
  ctx.beginPath();
  ctx.arc(x, y, raio, 0, 2 * Math.PI);
  ctx.fillStyle = cor;
  ctx.fill();
}

function draw(){
  const canvasEl = document.getElementById("mesh");
  if (!canvasEl) return;
  const ctx = canvasEl.getContext("2d");

  // 1) avança UMA iteração do modelo
  for (const p of all_points) p.run(all_points); // usa neighbors/real_neighbors da sua classe

  // 2) custo máximo observado (para escalar a cor da linha)
  let maxCost = 1;
  for (const p of all_points){
    for (const c of Object.values(p.neighbors || {})){
      if (typeof c === "number" && isFinite(c)) maxCost = Math.max(maxCost, c);
    }
  }

  // 3) limpa a tela
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

  // 4) desenha linhas do ponto para o vizinho de menor custo
  ctx.lineWidth = 1;
  for (const p of all_points){
    if (p.type === "gtw") continue; // nao desenha do gateway
    const entries = Object.entries(p.neighbors || {});
    if (!entries.length) continue;

    entries.sort((a, b) => a[1] - b[1]); // menor custo primeiro
    const [bestId, bestCost] = entries[0];
    const q = (p.real_neighbors || {})[bestId];
    if (!q) continue;

    ctx.beginPath();
    ctx.moveTo(p.position[0], p.position[1]);
    ctx.lineTo(q.position[0], q.position[1]);
    ctx.strokeStyle = colorFromCost(bestCost, maxCost);
    ctx.stroke();
  }

  // 5) desenha as bolinhas (vermelha = gtw, azul = node) por cima
  for (const p of all_points){
    const [x, y] = p.position;
    const cor = p.type === "gtw" ? "red" : "blue";
    desenharPonto(x, y, cor, p.type === "gtw" ? 6 : 4);
  }
}

(function start(){
  const T = 1000/20;
  function tick(){ draw(); setTimeout(tick, T); }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tick, { once:true });
  } else {
    tick();
  }
})();

const FPS = 12;
const _timer = setInterval(draw, 1000 / FPS);

draw();
