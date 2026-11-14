<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api, currentUser, type SharedFlow } from '../api'

const flows = ref<SharedFlow[]>([])
const hot = ref(false)
const loading = ref(false)
const uploading = ref(false)
const dialog = ref(false)
const draft = ref({ name: '', description: '', nodeCount: 1 })
const file = ref<File | null>(null)

async function load() {
  loading.value = true
  try {
    flows.value = await api<SharedFlow[]>('get', `/flows?sort=${hot.value ? 'hot' : 'latest'}`)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '加载流程失败')
  } finally {
    loading.value = false
  }
}
function pick(f: File | null) {
  if (f && !f.name.toLowerCase().endsWith('.leafrpa')) {
    ElMessage.warning('仅支持 .leafrpa 文件')
    file.value = null
    return
  }
  file.value = f
}
function openDialog() {
  if (!currentUser()) {
    ElMessage.warning('请先登录后再上传流程')
    return
  }
  draft.value = { name: '', description: '', nodeCount: 1 }
  file.value = null
  dialog.value = true
}
async function upload() {
  if (!draft.value.name.trim()) {
    ElMessage.warning('请填写流程名称')
    return
  }
  if (!file.value) {
    ElMessage.warning('请选择 .leafrpa 文件')
    return
  }
  uploading.value = true
  try {
    const form = new FormData()
    form.append('name', draft.value.name.trim())
    form.append('description', draft.value.description)
    form.append('nodeCount', String(draft.value.nodeCount))
    form.append('file', file.value)
    const res = await fetch('/api/flows', {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('leaf.token')}` },
      body: form
    })
    if (res.status === 401) throw new Error('登录已过期，请重新登录')
    const json = await res.json()
    if (json.code !== 0) throw new Error(json.message || '上传失败')
    await load()
    dialog.value = false
    ElMessage.success('上传成功')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '上传失败')
  } finally {
    uploading.value = false
  }
}
async function remove(f: SharedFlow) {
  try {
    await ElMessageBox.confirm(
      `删除「${f.name}」后其他人将无法再下载该流程，且无法恢复。`,
      '删除流程',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }
  try {
    await api('delete', `/flows/${f.id}`)
    await load()
    ElMessage.success('已删除')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '删除失败')
  }
}
function downloadUrl(f: SharedFlow): string {
  return `/api/flows/${f.id}/download`
}
onMounted(load)
</script>

<template>
  <el-card shadow="never">
    <el-form inline>
      <el-radio-group v-model="hot" @change="load">
        <el-radio-button :value="false">最新</el-radio-button>
        <el-radio-button :value="true">热门</el-radio-button>
      </el-radio-group>
      <el-button type="primary" :disabled="!currentUser()" @click="openDialog">上传流程</el-button>
    </el-form>
    <div v-loading="loading">
      <el-empty v-if="flows.length === 0 && !loading" description="还没有分享的流程" />
      <el-table v-else :data="flows" style="width: 100%">
      <el-table-column prop="name" label="名称" min-width="160" />
      <el-table-column prop="description" label="描述" min-width="200" />
      <el-table-column prop="author" label="作者" width="120" />
      <el-table-column prop="nodeCount" label="节点数" width="90" />
      <el-table-column prop="downloads" label="下载量" width="90" />
      <el-table-column label="操作" width="200">
        <template #default="{ row }">
          <a :href="downloadUrl(row)"><el-button type="primary">下载</el-button></a>
          <el-button v-if="row.author === currentUser()" type="danger" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
      </el-table>
    </div>
    <el-dialog v-model="dialog" title="上传 .leafrpa 流程" width="520">
      <el-form label-width="64">
        <el-form-item label="名称"><el-input v-model="draft.name" maxlength="120" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="draft.description" maxlength="255" /></el-form-item>
        <el-form-item label="节点数"><el-input-number v-model="draft.nodeCount" :min="0" /></el-form-item>
        <el-form-item label="文件">
          <input type="file" accept=".leafrpa" @change="(e: any) => pick(e.target.files?.[0] ?? null)" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" :loading="uploading" @click="upload">上传</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>
