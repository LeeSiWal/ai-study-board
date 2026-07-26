import type { Resource, ResourceType } from "./types";

/**
 * 페이지 트리.
 *
 * UI 명세 §9는 문서·화이트보드·파일을 별개 메뉴로 나누지 않고 하나의 트리로
 * 합친다. 사용자가 자료를 찾는 방식이 타입이 아니라 주차·주제이기 때문이다.
 */

export interface ResourceNode {
  id: string;
  parentId: string | null;
  type: ResourceType;
  title: string;
  icon: string | null;
  children: ResourceNode[];
}

/** 평평한 목록을 트리로 만든다. 각 단계는 sortOrder 순서를 지킨다. */
export function buildResourceTree(resources: Resource[]): ResourceNode[] {
  const nodes = new Map<string, ResourceNode>();

  for (const resource of resources) {
    nodes.set(resource.id, {
      id: resource.id,
      parentId: resource.parentId,
      type: resource.type,
      title: resource.title,
      icon: resource.icon,
      children: [],
    });
  }

  const roots: ResourceNode[] = [];

  for (const resource of resources) {
    const node = nodes.get(resource.id);
    if (!node) continue;

    // 부모가 목록에 없으면(권한 등으로 걸러졌다면) 최상위로 올린다.
    // 그러지 않으면 자식이 트리에서 통째로 사라진다.
    const parent = resource.parentId ? nodes.get(resource.parentId) : null;

    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const order = new Map(resources.map((r, index) => [r.id, index]));
  const sort = (list: ResourceNode[]) => {
    list.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    list.forEach((node) => sort(node.children));
  };

  sort(roots);
  return roots;
}

/**
 * 최상위부터 대상까지의 경로. 상단 바 브레드크럼(§6)과
 * 트리에서 현재 페이지의 조상을 펼치는 데 쓴다.
 */
export function findResourcePath(
  tree: ResourceNode[],
  resourceId: string,
): ResourceNode[] {
  for (const node of tree) {
    if (node.id === resourceId) return [node];

    const nested = findResourcePath(node.children, resourceId);
    if (nested.length) return [node, ...nested];
  }

  return [];
}
