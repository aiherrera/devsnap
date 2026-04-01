import { execa } from 'execa'
import { withCmdTimeout } from '../util/execa-options.js'
import type { ScannerResult, DockerInfo, DockerImage, DockerContainer } from '../types.js'

export async function scanDocker(): Promise<ScannerResult<DockerInfo>> {
  try {
    const versionResult = await execa('docker', ['version', '--format', '{{.Server.Version}}'], withCmdTimeout()).catch(() => null)
    if (!versionResult) {
      return { status: 'unavailable', data: null }
    }
    const version = versionResult.stdout.trim()

    const [imagesResult, containersResult] = await Promise.all([
      execa(
        'docker',
        ['images', '--format', '{{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.Size}}\t{{.CreatedAt}}'],
        withCmdTimeout(),
      ).catch(() => null),
      execa(
        'docker',
        ['ps', '--format', '{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'],
        withCmdTimeout(),
      ).catch(() => null),
    ])

    const images: DockerImage[] = (imagesResult?.stdout ?? '')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [repository, tag, id, size, ...createdParts] = line.split('\t')
        return {
          repository: repository ?? '',
          tag: tag ?? '',
          id: id ?? '',
          size: size ?? '',
          created: createdParts.join(' '),
        }
      })

    const runningContainers: DockerContainer[] = (containersResult?.stdout ?? '')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [id, name, image, status, ports] = line.split('\t')
        return {
          id: id ?? '',
          name: name ?? '',
          image: image ?? '',
          status: status ?? '',
          ports: ports ?? '',
        }
      })

    return { status: 'ok', data: { version, images, runningContainers } }
  } catch (err) {
    return { status: 'error', data: null, error: String(err) }
  }
}
