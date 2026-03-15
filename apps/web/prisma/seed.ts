import { PrismaClient, NodeType, Difficulty, ProblemStatus, ExecutionRuntime, CppStandard, CudaVersion, ComputeCap } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

const TRACKS = [
  {
    slug: 'cuda',
    title: 'CUDA & GPU Programming',
    description: 'Master parallel GPU programming from first principles to optimized kernels.',
    icon: '⚡',
    color: '#7C3AED',
    order: 1,
  },
  {
    slug: 'ml-systems',
    title: 'ML Systems & Inference',
    description: 'Build and optimize inference pipelines for large-scale ML serving.',
    icon: '🧠',
    color: '#0891B2',
    order: 2,
  },
  {
    slug: 'kubernetes-ai',
    title: 'Kubernetes for AI',
    description: 'Deploy, scale, and operate GPU workloads on Kubernetes.',
    icon: '☸',
    color: '#059669',
    order: 3,
  },
  {
    slug: 'foundations',
    title: 'Foundations',
    description: 'Core systems and hardware knowledge every AI infrastructure engineer needs.',
    icon: '🏗',
    color: '#D97706',
    order: 4,
  },
]

const NODES: {
  slug: string
  title: string
  description: string
  type: NodeType
  trackSlug: string
  order: number
  prerequisites: string[]
}[] = [
  // ── CUDA track ──────────────────────────────────────────────────────────────
  {
    slug: 'cuda-intro',
    title: 'Introduction to CUDA',
    description: 'Understand the GPU programming model, SM architecture, and the CUDA execution model.',
    type: NodeType.CONCEPT,
    trackSlug: 'cuda',
    order: 1,
    prerequisites: [],
  },
  {
    slug: 'cuda-threads',
    title: 'Threads, Blocks & Grids',
    description: 'Learn how CUDA organises parallel work into threads, blocks, and grids with 1-D and 2-D layouts.',
    type: NodeType.CONCEPT,
    trackSlug: 'cuda',
    order: 2,
    prerequisites: ['cuda-intro'],
  },
  {
    slug: 'cuda-memory',
    title: 'Memory Hierarchy',
    description: 'Master global, shared, constant, and register memory and their latency trade-offs.',
    type: NodeType.CONCEPT,
    trackSlug: 'cuda',
    order: 3,
    prerequisites: ['cuda-threads'],
  },
  {
    slug: 'vector-add',
    title: 'Vector Addition',
    description: 'Implement parallel element-wise vector addition as your first CUDA kernel.',
    type: NodeType.PROBLEM,
    trackSlug: 'cuda',
    order: 4,
    prerequisites: ['cuda-threads'],
  },
  {
    slug: 'matrix-multiply',
    title: 'Tiled Matrix Multiplication',
    description: 'Write an optimised tiled matrix-multiply kernel that exploits shared memory to cut global-memory traffic.',
    type: NodeType.PROBLEM,
    trackSlug: 'cuda',
    order: 5,
    prerequisites: ['cuda-memory', 'vector-add'],
  },
  {
    slug: 'cuda-streams',
    title: 'CUDA Streams & Async Transfers',
    description: 'Overlap kernel execution with H2D/D2H transfers using CUDA streams and events.',
    type: NodeType.CONCEPT,
    trackSlug: 'cuda',
    order: 6,
    prerequisites: ['matrix-multiply'],
  },

  // ── ML Systems track ─────────────────────────────────────────────────────────
  {
    slug: 'ml-inference-basics',
    title: 'Inference Fundamentals',
    description: 'Understand the end-to-end inference pipeline from model loading to first-token latency.',
    type: NodeType.CONCEPT,
    trackSlug: 'ml-systems',
    order: 1,
    prerequisites: [],
  },
  {
    slug: 'quantization-intro',
    title: 'Model Quantization',
    description: 'Learn INT8 and FP16 post-training quantisation for throughput and memory savings.',
    type: NodeType.CONCEPT,
    trackSlug: 'ml-systems',
    order: 2,
    prerequisites: ['ml-inference-basics'],
  },
  {
    slug: 'kv-cache',
    title: 'KV Cache Implementation',
    description: 'Implement a key-value cache for autoregressive transformer inference to eliminate redundant computation.',
    type: NodeType.PROBLEM,
    trackSlug: 'ml-systems',
    order: 3,
    prerequisites: ['ml-inference-basics'],
  },
  {
    slug: 'batched-inference',
    title: 'Continuous Batching Scheduler',
    description: 'Write a continuous-batching scheduler that maximises GPU utilisation for LLM serving.',
    type: NodeType.PROBLEM,
    trackSlug: 'ml-systems',
    order: 4,
    prerequisites: ['kv-cache', 'quantization-intro'],
  },
  {
    slug: 'flash-attention',
    title: 'Flash Attention',
    description: 'Implement the IO-aware Flash Attention algorithm that fuses attention into a single SRAM-resident kernel.',
    type: NodeType.PROBLEM,
    trackSlug: 'ml-systems',
    order: 5,
    prerequisites: ['batched-inference'],
  },

  // ── Kubernetes for AI track ───────────────────────────────────────────────────
  {
    slug: 'k8s-basics',
    title: 'Kubernetes Fundamentals',
    description: 'Learn pods, deployments, services, ConfigMaps, and namespaces through hands-on exercises.',
    type: NodeType.CONCEPT,
    trackSlug: 'kubernetes-ai',
    order: 1,
    prerequisites: [],
  },
  {
    slug: 'gpu-operator',
    title: 'NVIDIA GPU Operator',
    description: 'Deploy the NVIDIA GPU Operator to expose GPU devices to Kubernetes workloads without manual driver management.',
    type: NodeType.CONCEPT,
    trackSlug: 'kubernetes-ai',
    order: 2,
    prerequisites: ['k8s-basics'],
  },
  {
    slug: 'deploy-inference-server',
    title: 'Deploy an Inference Server',
    description: 'Package a vLLM inference server as a Kubernetes Deployment with GPU resource limits and liveness probes.',
    type: NodeType.PROBLEM,
    trackSlug: 'kubernetes-ai',
    order: 3,
    prerequisites: ['gpu-operator'],
  },
  {
    slug: 'hpa-gpu',
    title: 'Autoscaling GPU Workloads',
    description: 'Configure a Horizontal Pod Autoscaler backed by custom GPU-utilisation metrics to right-size inference replicas.',
    type: NodeType.PROBLEM,
    trackSlug: 'kubernetes-ai',
    order: 4,
    prerequisites: ['deploy-inference-server'],
  },

  // ── Foundations track ────────────────────────────────────────────────────────
  {
    slug: 'memory-model',
    title: 'CPU Memory Hierarchy',
    description: 'Understand L1/L2/L3 cache hierarchies, cache lines, TLBs, and NUMA topology and how they affect bandwidth.',
    type: NodeType.CONCEPT,
    trackSlug: 'foundations',
    order: 1,
    prerequisites: [],
  },
  {
    slug: 'simd-basics',
    title: 'SIMD & Vectorisation',
    description: 'Use AVX2/SSE intrinsics and auto-vectorisation hints to accelerate data-parallel CPU loops.',
    type: NodeType.CONCEPT,
    trackSlug: 'foundations',
    order: 2,
    prerequisites: ['memory-model'],
  },
  {
    slug: 'pcie-bandwidth',
    title: 'PCIe Transfer Bandwidth',
    description: 'Measure and optimise host-to-device and device-to-host transfer rates across the PCIe bus.',
    type: NodeType.PROBLEM,
    trackSlug: 'foundations',
    order: 3,
    prerequisites: ['memory-model'],
  },
  {
    slug: 'profiling-basics',
    title: 'Profiling GPU Code',
    description: 'Use Nsight Systems and Nsight Compute to identify hotspots, memory bottlenecks, and warp stalls.',
    type: NodeType.CONCEPT,
    trackSlug: 'foundations',
    order: 4,
    prerequisites: ['pcie-bandwidth'],
  },
  {
    slug: 'roofline-model',
    title: 'Roofline Analysis',
    description: 'Apply the roofline model to determine whether a kernel is compute-bound or memory-bandwidth-bound.',
    type: NodeType.PROBLEM,
    trackSlug: 'foundations',
    order: 5,
    prerequisites: ['profiling-basics', 'simd-basics'],
  },
]

const PROBLEMS: {
  slug: string
  title: string
  difficulty: Difficulty
  trackSlug: string
  tags: string[]
  xpReward: number
  executionRuntime: ExecutionRuntime
  cppStandard: CppStandard
  cudaVersion?: CudaVersion
  computeCap?: ComputeCap
}[] = [
  // ── CUDA track ───────────────────────────────────────────────────────────────
  {
    slug: 'vector-add',
    title: 'Vector Addition',
    difficulty: Difficulty.EASY,
    trackSlug: 'cuda',
    tags: ['memory', 'threads', 'indexing'],
    xpReward: 100,
    executionRuntime: ExecutionRuntime.CUDA,
    cppStandard: CppStandard.CPP17,
    cudaVersion: CudaVersion.CUDA_12_6,
    computeCap: ComputeCap.SM_120,
  },
  {
    slug: 'matrix-transpose',
    title: 'Matrix Transpose',
    difficulty: Difficulty.MEDIUM,
    trackSlug: 'cuda',
    tags: ['memory', 'coalescing', 'shared-memory'],
    xpReward: 200,
    executionRuntime: ExecutionRuntime.CUDA,
    cppStandard: CppStandard.CPP17,
    cudaVersion: CudaVersion.CUDA_12_6,
    computeCap: ComputeCap.SM_120,
  },
  {
    slug: 'reduce-sum',
    title: 'Parallel Reduction Sum',
    difficulty: Difficulty.HARD,
    trackSlug: 'cuda',
    tags: ['reduction', 'shared-memory', 'warp-primitives'],
    xpReward: 400,
    executionRuntime: ExecutionRuntime.CUDA,
    cppStandard: CppStandard.CPP17,
    cudaVersion: CudaVersion.CUDA_12_6,
    computeCap: ComputeCap.SM_120,
  },

  // ── ML Systems track ─────────────────────────────────────────────────────────
  {
    slug: 'kv-cache',
    title: 'KV Cache Implementation',
    difficulty: Difficulty.EASY,
    trackSlug: 'ml-systems',
    tags: ['transformers', 'inference', 'caching'],
    xpReward: 100,
    executionRuntime: ExecutionRuntime.CPP,
    cppStandard: CppStandard.CPP17,
  },
  {
    slug: 'batched-inference',
    title: 'Continuous Batching Scheduler',
    difficulty: Difficulty.MEDIUM,
    trackSlug: 'ml-systems',
    tags: ['serving', 'throughput', 'scheduling'],
    xpReward: 250,
    executionRuntime: ExecutionRuntime.CPP,
    cppStandard: CppStandard.CPP17,
  },
  {
    slug: 'flash-attention',
    title: 'Flash Attention Forward Pass',
    difficulty: Difficulty.HARD,
    trackSlug: 'ml-systems',
    tags: ['attention', 'memory-efficiency', 'io-aware'],
    xpReward: 500,
    executionRuntime: ExecutionRuntime.CPP,
    cppStandard: CppStandard.CPP17,
  },

  // ── Kubernetes for AI track ───────────────────────────────────────────────────
  {
    slug: 'deploy-inference-server',
    title: 'Deploy a vLLM Inference Server',
    difficulty: Difficulty.EASY,
    trackSlug: 'kubernetes-ai',
    tags: ['deployment', 'vllm', 'resources'],
    xpReward: 100,
    executionRuntime: ExecutionRuntime.CPP,
    cppStandard: CppStandard.CPP17,
  },
  {
    slug: 'hpa-gpu',
    title: 'Autoscale GPU Inference with HPA',
    difficulty: Difficulty.MEDIUM,
    trackSlug: 'kubernetes-ai',
    tags: ['autoscaling', 'hpa', 'custom-metrics'],
    xpReward: 200,
    executionRuntime: ExecutionRuntime.CPP,
    cppStandard: CppStandard.CPP17,
  },
  {
    slug: 'multi-node-training',
    title: 'Multi-Node Distributed Training Job',
    difficulty: Difficulty.HARD,
    trackSlug: 'kubernetes-ai',
    tags: ['distributed', 'pytorch', 'mpi', 'networking'],
    xpReward: 400,
    executionRuntime: ExecutionRuntime.CPP,
    cppStandard: CppStandard.CPP17,
  },

  // ── Foundations track ────────────────────────────────────────────────────────
  {
    slug: 'pcie-bandwidth',
    title: 'Measure PCIe Transfer Bandwidth',
    difficulty: Difficulty.EASY,
    trackSlug: 'foundations',
    tags: ['memory', 'bandwidth', 'profiling'],
    xpReward: 100,
    executionRuntime: ExecutionRuntime.CPP,
    cppStandard: CppStandard.CPP17,
  },
  {
    slug: 'roofline-model',
    title: 'Roofline Model Analysis',
    difficulty: Difficulty.MEDIUM,
    trackSlug: 'foundations',
    tags: ['performance', 'roofline', 'arithmetic-intensity'],
    xpReward: 200,
    executionRuntime: ExecutionRuntime.CPP,
    cppStandard: CppStandard.CPP17,
  },
  {
    slug: 'false-sharing',
    title: 'Eliminate False Sharing',
    difficulty: Difficulty.HARD,
    trackSlug: 'foundations',
    tags: ['cpu', 'cache', 'concurrency', 'false-sharing'],
    xpReward: 300,
    executionRuntime: ExecutionRuntime.CPP,
    cppStandard: CppStandard.CPP17,
  },
]

async function main() {
  console.log('Seeding tracks...')
  for (const track of TRACKS) {
    await prisma.track.upsert({
      where: { slug: track.slug },
      update: track,
      create: track,
    })
  }

  const trackMap = new Map(
    (await prisma.track.findMany({ select: { id: true, slug: true } })).map((t) => [t.slug, t.id]),
  )

  console.log('Seeding roadmap nodes...')
  for (const { trackSlug, ...node } of NODES) {
    const trackId = trackMap.get(trackSlug)
    if (!trackId) throw new Error(`Unknown track slug: ${trackSlug}`)
    await prisma.roadmapNode.upsert({
      where: { slug: node.slug },
      update: { ...node, trackId },
      create: { ...node, trackId },
    })
  }

  console.log('Seeding problems...')
  for (const { trackSlug, ...problem } of PROBLEMS) {
    const trackId = trackMap.get(trackSlug)
    if (!trackId) throw new Error(`Unknown track slug: ${trackSlug}`)
    await prisma.problem.upsert({
      where: { slug: problem.slug },
      update: { ...problem, trackId, status: ProblemStatus.PUBLISHED },
      create: { ...problem, trackId, status: ProblemStatus.PUBLISHED },
    })
  }

  console.log(
    `✅ Seeded ${TRACKS.length} tracks, ${NODES.length} roadmap nodes, ${PROBLEMS.length} problems.`,
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
