"""观察窗口测试 - M0-e 4个Tab + M0-g集成"""
import pytest


class TestAgentDirectory:
    """观察窗口 - Agent目录Tab"""

    def test_agent_directory(self, client):
        """查询Agent目录"""
        r = client.get("/observatory/agents")
        assert r.status_code == 200
        data = r.json()
        assert "agents" in data or "items" in data or isinstance(data, list)

    def test_agent_directory_with_pagination(self, client):
        """Agent目录分页"""
        r = client.get("/observatory/agents", params={"page": 1, "page_size": 10})
        assert r.status_code == 200
        data = r.json()
        total = data.get("total", data.get("total_count", 0))
        assert total >= 0

    def test_agent_directory_search(self, client):
        """Agent目录搜索"""
        r = client.get("/observatory/agents", params={"search": "trader"})
        assert r.status_code == 200

    def test_agent_directory_capability_filter(self, client):
        """Agent目录能力筛选"""
        r = client.get("/observatory/agents", params={"capability": "market_analysis"})
        assert r.status_code == 200


class TestProjectProgress:
    """观察窗口 - 项目进度Tab"""

    def test_project_list(self, client):
        """查询项目列表"""
        r = client.get("/observatory/projects")
        assert r.status_code == 200
        data = r.json()
        assert "projects" in data or "items" in data or isinstance(data, list)

    def test_project_detail(self, client):
        """查询项目详情"""
        # First get project list to find an ID
        r = client.get("/observatory/projects")
        if r.status_code == 200:
            data = r.json()
            projects = data.get("projects", data.get("items", data if isinstance(data, list) else []))
            if projects:
                project_id = projects[0].get("project_id", projects[0].get("id", ""))
                if project_id:
                    r2 = client.get(f"/observatory/projects/{project_id}")
                    assert r2.status_code in (200, 404)


class TestOrganizationProfile:
    """观察窗口 - 组织画像Tab"""

    def test_organization_list(self, client):
        """查询组织列表"""
        r = client.get("/observatory/organizations")
        assert r.status_code == 200
        data = r.json()
        assert "organizations" in data or "items" in data or isinstance(data, list)

    def test_organization_detail(self, client):
        """查询组织详情"""
        r = client.get("/observatory/organizations")
        if r.status_code == 200:
            data = r.json()
            orgs = data.get("organizations", data.get("items", data if isinstance(data, list) else []))
            if orgs:
                org_id = orgs[0].get("organization_id", orgs[0].get("id", ""))
                if org_id:
                    r2 = client.get(f"/observatory/organizations/{org_id}")
                    assert r2.status_code in (200, 404)


class TestReputationLeaderboard:
    """观察窗口 - 信用排行榜Tab"""

    def test_leaderboard(self, client):
        """查询信用排行榜"""
        r = client.get("/observatory/leaderboard")
        assert r.status_code == 200
        data = r.json()
        assert "entries" in data or "leaderboard" in data or isinstance(data, list)

    def test_leaderboard_with_sort(self, client):
        """排行榜排序"""
        r = client.get("/observatory/leaderboard", params={"sort_by": "reputation", "order": "desc"})
        assert r.status_code == 200

    def test_leaderboard_with_pagination(self, client):
        """排行榜分页"""
        r = client.get("/observatory/leaderboard", params={"page": 1, "page_size": 20})
        assert r.status_code == 200
